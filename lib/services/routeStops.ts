import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { assertRouteAccessible, type RouteActor } from "@/lib/services/routes";
import type { RouteStopStatus } from "@prisma/client";

export async function startRoute(routeId: string, actor: RouteActor) {
  const route = await db.route.findUnique({ where: { id: routeId }, include: { stops: true } });
  if (!route) throw new NotFoundError("Route not found");
  assertRouteAccessible(route, actor);
  if (route.status !== "PLANNED") throw new ConflictError(`Route is already ${route.status.toLowerCase()}`);

  if (route.awaitingDriverLocation) throw new ConflictError("Plan this round from your current location before starting deliveries.");

  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`routes:${route.date.toISOString()}`}))`;
    const fresh = await tx.route.findUniqueOrThrow({where:{id:routeId}});
    if(fresh.status!=="PLANNED" || fresh.updatedAt.getTime()!==route.updatedAt.getTime()) throw new ConflictError("The route changed. Refresh before starting.");
    // A driver starting an unassigned round claims it, so later stop
    // updates and re-plans are locked to them.
    const driverId = actor.role === "DRIVER" ? (fresh.driverId ?? actor.userId) : fresh.driverId;
    await tx.route.update({ where: { id: routeId }, data: { status: "IN_PROGRESS", startedAt: new Date(), driverId } });
    await tx.order.updateMany({where:{id:{in:route.stops.map(s=>s.orderId)}},data:{status:"OUT_FOR_DELIVERY"}});
  });

  await recordAudit({
    action: "ROUTE_STARTED",
    entityType: "Route",
    entityId: routeId,
    actorUserId: actor.userId,
    actorType: "driver",
  });

  return db.route.findUniqueOrThrow({ where: { id: routeId } });
}

export interface UpdateStopStatusInput {
  stopId: string;
  status: Extract<RouteStopStatus, "DELIVERED" | "SKIPPED" | "UNAVAILABLE">;
  failureReason?: string;
  actor: RouteActor;
}

export async function updateStopStatus(input: UpdateStopStatusInput) {
  const existing = await db.routeStop.findUnique({ where: { id: input.stopId }, include: { route: true } });
  if (!existing) throw new NotFoundError("Route stop not found");
  assertRouteAccessible(existing.route, input.actor);

  const now = new Date();

  // Everything authoritative happens under the same per-date advisory lock
  // reoptimizeRoute takes, so a stop update and a concurrent re-plan cannot
  // interleave. Re-read the route and stop inside the lock (a re-plan may
  // have cancelled this route or superseded this stop since we read above),
  // settle the stop, complete the route in the same transaction when it is
  // the last one, and always bump the route's updatedAt so an in-flight
  // reoptimize fails its optimistic version check instead of silently
  // dropping this delivery.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`routes:${existing.route.date.toISOString()}`}))`;

    const stop = await tx.routeStop.findUnique({ where: { id: input.stopId }, include: { route: true } });
    if (!stop) throw new NotFoundError("Route stop not found");
    assertRouteAccessible(stop.route, input.actor);
    if (stop.route.status === "PLANNED") {
      throw new ConflictError("Start the route before marking stops");
    }
    if (stop.route.status !== "IN_PROGRESS") {
      throw new ConflictError("This round is no longer active — it was re-planned or completed. Refresh and try again.");
    }
    if (stop.status === "DELIVERED" || stop.status === "SKIPPED" || stop.status === "UNAVAILABLE") {
      throw new ConflictError("This stop has already been settled");
    }

    await tx.routeStop.update({
      where: { id: input.stopId },
      data: {
        status: input.status,
        actualArrival: stop.actualArrival ?? now,
        deliveredAt: input.status === "DELIVERED" ? now : undefined,
        failureReason: input.status === "DELIVERED" ? undefined : (input.failureReason ?? input.status),
      },
    });

    if (input.status === "DELIVERED") {
      await tx.order.update({ where: { id: stop.orderId }, data: { status: "DELIVERED" } });
    }

    const stops = await tx.routeStop.findMany({ where: { routeId: stop.routeId } });
    const allSettled = stops.every((s) => s.status !== "PENDING" && s.status !== "EN_ROUTE");
    await tx.route.update({
      where: { id: stop.routeId },
      data: allSettled
        ? { status: "COMPLETED", completedAt: now, updatedAt: now }
        : { updatedAt: now },
    });
  });

  await recordAudit({
    action:
      input.status === "DELIVERED"
        ? "DELIVERY_COMPLETED"
        : input.status === "SKIPPED"
          ? "DELIVERY_SKIPPED"
          : "DELIVERY_UNAVAILABLE",
    entityType: "RouteStop",
    entityId: input.stopId,
    actorUserId: input.actor.userId,
    actorType: "driver",
    metadata: { orderId: existing.orderId, reason: input.failureReason },
  });

  return db.routeStop.findUniqueOrThrow({ where: { id: input.stopId } });
}
