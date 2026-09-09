import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { NotFoundError, ConflictError } from "@/lib/errors";
import type { RouteStopStatus } from "@prisma/client";

export async function startRoute(routeId: string, actorUserId?: string) {
  const route = await db.route.findUnique({ where: { id: routeId }, include: { stops: true } });
  if (!route) throw new NotFoundError("Route not found");
  if (route.status !== "PLANNED") throw new ConflictError(`Route is already ${route.status.toLowerCase()}`);

  if (route.awaitingDriverLocation) throw new ConflictError("Plan this round from your current location before starting deliveries.");

  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`routes:${route.date.toISOString()}`}))`;
    const fresh = await tx.route.findUniqueOrThrow({where:{id:routeId}});
    if(fresh.status!=="PLANNED" || fresh.updatedAt.getTime()!==route.updatedAt.getTime()) throw new ConflictError("The route changed. Refresh before starting.");
    await tx.route.update({ where: { id: routeId }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    await tx.order.updateMany({where:{id:{in:route.stops.map(s=>s.orderId)}},data:{status:"OUT_FOR_DELIVERY"}});
  });

  await recordAudit({
    action: "ROUTE_STARTED",
    entityType: "Route",
    entityId: routeId,
    actorUserId,
    actorType: "driver",
  });

  return db.route.findUniqueOrThrow({ where: { id: routeId } });
}

async function maybeCompleteRoute(routeId: string) {
  const stops = await db.routeStop.findMany({ where: { routeId } });
  const allSettled = stops.every((s) => s.status !== "PENDING" && s.status !== "EN_ROUTE");
  if (allSettled) {
    await db.route.update({ where: { id: routeId }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
}

export interface UpdateStopStatusInput {
  stopId: string;
  status: Extract<RouteStopStatus, "DELIVERED" | "SKIPPED" | "UNAVAILABLE">;
  failureReason?: string;
  actorUserId?: string;
}

export async function updateStopStatus(input: UpdateStopStatusInput) {
  const stop = await db.routeStop.findUnique({ where: { id: input.stopId }, include: { route: true } });
  if (!stop) throw new NotFoundError("Route stop not found");
  if (stop.status === "DELIVERED" || stop.status === "SKIPPED" || stop.status === "UNAVAILABLE") {
    throw new ConflictError("This stop has already been settled");
  }
  if (stop.route.status !== "IN_PROGRESS") {
    throw new ConflictError("Start the route before marking stops");
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
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
    actorUserId: input.actorUserId,
    actorType: "driver",
    metadata: { orderId: stop.orderId, reason: input.failureReason },
  });

  await maybeCompleteRoute(stop.routeId);

  return db.routeStop.findUniqueOrThrow({ where: { id: input.stopId } });
}
