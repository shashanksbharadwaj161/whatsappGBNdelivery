import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { recordAudit } from "@/lib/audit";
import { optimizeRoute, type RouteWaypoint, type OptimizeRouteResult } from "@/lib/maps/routes";
import { hasCoordinates } from "@/lib/services/addresses";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { businessDateOnlyToDate } from "@/lib/tz";

export interface CreateRouteInput {
  orderIds: string[];
  startLat: number;
  startLng: number;
  startTime: Date;
  actorUserId?: string;
  driverId?: string;
  returnToStart?: boolean;
}

function milkQuantityLabel(order: { milkSize: string; quantity: number; customQuantityLiters: number | null }) {
  const unit = order.milkSize === "ML500" ? "500 ml" : order.milkSize === "L1" ? "1 Litre" : `${order.customQuantityLiters} L`;
  return `${order.quantity}× ${unit}`;
}

type OrderWithRelations = Prisma.OrderGetPayload<{ include: { address: true; customer: true } }>;

/** Inserts RouteStop rows (with snapshots) for an optimize result, continuing stopNumber from startingStopNumber. */
async function insertRouteStops(
  tx: Prisma.TransactionClient,
  routeId: string,
  result: OptimizeRouteResult,
  ordersById: Map<string, OrderWithRelations>,
  startingStopNumber: number
) {
  for (const [i, stop] of result.stops.entries()) {
    const order = ordersById.get(stop.id)!;
    await tx.routeStop.create({
      data: {
        routeId,
        orderId: order.id,
        stopNumber: startingStopNumber + i,
        customerNameSnapshot: order.customer.name,
        addressTextSnapshot: order.address.formattedAddress,
        latitudeSnapshot: order.address.latitude!,
        longitudeSnapshot: order.address.longitude!,
        quantitySnapshot: milkQuantityLabel(order),
        estimatedArrival: stop.estimatedArrival,
        plannedDistanceFromPreviousKm: stop.distanceFromPreviousKm,
        plannedDurationFromPreviousMinutes: Math.round(stop.durationFromPreviousMinutes),
        status: "PENDING",
      },
    });
  }
}

export async function createOptimizedRoute(input: CreateRouteInput) {
  if (input.orderIds.length === 0) {
    throw new ValidationError("Select at least one order to optimize a route");
  }

  const orders = await db.order.findMany({
    where: { id: { in: input.orderIds } },
    include: { address: true, customer: true },
  });

  if (orders.length !== input.orderIds.length) {
    throw new NotFoundError("One or more selected orders could not be found");
  }

  const invalid = orders.filter((o) => o.status !== "CONFIRMED" || !hasCoordinates(o.address));
  if (invalid.length > 0) {
    throw new ValidationError(
      `${invalid.length} selected order(s) are not confirmed or have no resolved address — remove them and try again`
    );
  }

  const deliveryDates = new Set(orders.map((o) => o.deliveryDate.toISOString()));
  if (deliveryDates.size > 1) {
    throw new ValidationError("All selected orders must share the same delivery date");
  }
  const deliveryDate = orders[0].deliveryDate;

  const alreadyRouted = await db.routeStop.findFirst({
    where: { orderId: { in: input.orderIds }, route: { status: { in: ["PLANNED", "IN_PROGRESS"] } } },
  });
  if (alreadyRouted) {
    throw new ValidationError("One or more selected orders are already on an active route");
  }

  const waypoints: RouteWaypoint[] = orders.map((o) => ({ id: o.id, lat: o.address.latitude!, lng: o.address.longitude! }));

  const result = await optimizeRoute({ lat: input.startLat, lng: input.startLng }, waypoints, input.startTime, input.returnToStart ?? true);

  const ordersById = new Map(orders.map((o) => [o.id, o]));

  const route = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`routes:${deliveryDate.toISOString()}`}))`;
    const taken = await tx.routeStop.findFirst({where:{orderId:{in:input.orderIds},route:{status:{in:["PLANNED","IN_PROGRESS"]}}}});
    if(taken) throw new ConflictError("An order was added to another route. Refresh and try again.");
    const createdRoute = await tx.route.create({
      data: {
        date: deliveryDate,
        driverId: input.driverId,
        returnToStart: input.returnToStart ?? true,
        startLocationLat: input.startLat,
        startLocationLng: input.startLng,
        plannedDistanceKm: result.totalDistanceKm,
        plannedDurationMinutes: Math.round(result.totalDurationMinutes),
        status: "PLANNED",
        usedDevFallback: result.usedDevFallback,
        createdByUserId: input.actorUserId,
      },
    });

    await insertRouteStops(tx, createdRoute.id, result, ordersById, 1);

    return createdRoute;
  });

  await recordAudit({
    action: "ROUTE_CREATED",
    entityType: "Route",
    entityId: route.id,
    actorUserId: input.actorUserId,
    metadata: { stopCount: result.stops.length, usedDevFallback: result.usedDevFallback },
  });

  return getRouteDetail(route.id);
}

export async function getRouteDetail(routeId: string) {
  const route = await db.route.findUnique({
    where: { id: routeId },
    include: {
      stops: {
        orderBy: { stopNumber: "asc" },
        include: { order: { include: { customer: true, address: true } } },
      },
      driver: true,
    },
  });
  if (!route) throw new NotFoundError("Route not found");
  return route;
}

/**
 * "Re-optimize remaining route" — creates a new Route revision. Stops
 * already DELIVERED/SKIPPED/UNAVAILABLE carry over unchanged (their
 * history must not move); the still-PENDING stops plus any newly added
 * orders are re-optimized together, starting from wherever the driver's
 * last completed stop was (or the original depot if none yet).
 */
export async function reoptimizeRoute(
  routeId: string,
  additionalOrderIds: string[],
  actorUserId?: string,
  currentLocation?: { lat: number; lng: number }
) {
  const current = await getRouteDetail(routeId);
  if (current.status !== "PLANNED" && current.status !== "IN_PROGRESS") {
    throw new ConflictError(`Route is already ${current.status.toLowerCase()} — nothing to re-optimize`);
  }

  if(current.awaitingDriverLocation && !currentLocation) throw new ValidationError("Use your current location to optimize this automatic delivery round first.");
  const settledStops = current.stops.filter((s) => s.status === "DELIVERED" || s.status === "SKIPPED" || s.status === "UNAVAILABLE");
  const pendingStops = current.stops.filter((s) => s.status === "PENDING" || s.status === "EN_ROUTE");
  const pendingOrderIds = pendingStops.map((s) => s.orderId);

  const combinedOrderIds = [...new Set([...pendingOrderIds, ...additionalOrderIds])];
  if (combinedOrderIds.length === 0) {
    throw new ValidationError("No pending or additional orders to re-optimize");
  }

  const orders = await db.order.findMany({
    where: { id: { in: combinedOrderIds } },
    include: { address: true, customer: true },
  });
  if (orders.length !== combinedOrderIds.length) {
    throw new NotFoundError("One or more orders could not be found");
  }

  // Orders already on this route's pending stops are legitimately
  // OUT_FOR_DELIVERY once the route has started — only newly-added
  // orders need to still be CONFIRMED (i.e. not yet on any route).
  const pendingOrderIdSet = new Set(pendingOrderIds);
  const invalid = orders.filter((o) => {
    if (!hasCoordinates(o.address)) return true;
    if (pendingOrderIdSet.has(o.id)) return o.status !== "CONFIRMED" && o.status !== "OUT_FOR_DELIVERY";
    return o.status !== "CONFIRMED";
  });
  if (invalid.length > 0) {
    throw new ValidationError(
      `${invalid.length} order(s) are not confirmed or have no resolved address — remove them and try again`
    );
  }

  const alreadyElsewhere = await db.routeStop.findFirst({
    where: {
      orderId: { in: additionalOrderIds },
      route: { status: { in: ["PLANNED", "IN_PROGRESS"] }, id: { not: routeId } },
    },
  });
  if (alreadyElsewhere) {
    throw new ValidationError("One or more added orders are already on another active route");
  }

  if(orders.some(o=>o.deliveryDate.getTime()!==current.date.getTime())) throw new ValidationError("Added orders must have the same delivery date as this route.");
  // Re-optimize from the last completed stop's location, or the
  // original depot if the driver hasn't delivered anything yet.
  const lastSettled = [...settledStops].reverse().find((s) => s.status === "DELIVERED");
  const origin = currentLocation ?? (lastSettled
    ? { lat: lastSettled.latitudeSnapshot, lng: lastSettled.longitudeSnapshot }
    : { lat: current.startLocationLat, lng: current.startLocationLng });

  const waypoints: RouteWaypoint[] = orders.map((o) => ({ id: o.id, lat: o.address.latitude!, lng: o.address.longitude! }));
  const result = await optimizeRoute(origin, waypoints, new Date(), current.returnToStart);
  const ordersById = new Map(orders.map((o) => [o.id, o]));

  const newRoute = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`routes:${current.date.toISOString()}`}))`;
    const fresh = await tx.route.findUniqueOrThrow({where:{id:current.id}});
    if(fresh.updatedAt.getTime() !== current.updatedAt.getTime()) throw new ConflictError("New deliveries or route changes arrived while planning. Refresh and retry.");
    const taken = await tx.routeStop.findFirst({where:{orderId:{in:additionalOrderIds},route:{id:{not:routeId},status:{in:["PLANNED","IN_PROGRESS"]}}}});
    if(taken) throw new ConflictError("An added order is already on another route.");
    const created = await tx.route.create({
      data: {
        date: current.date,
        autoGenerated: current.autoGenerated,
        awaitingDriverLocation: false,
        driverId: current.driverId,
        startLocationLat: origin.lat,
        startLocationLng: origin.lng,
        returnToStart: current.returnToStart,
        startedAt: current.startedAt,
        plannedDistanceKm: result.totalDistanceKm,
        plannedDurationMinutes: Math.round(result.totalDurationMinutes),
        status: current.status,
        usedDevFallback: result.usedDevFallback,
        revisionNumber: current.revisionNumber + 1,
        previousRouteId: current.id,
        createdByUserId: actorUserId,
      },
    });

    for (const [i, settled] of settledStops.entries()) {
      await tx.routeStop.create({
        data: {
          routeId: created.id,
          orderId: settled.orderId,
          stopNumber: i + 1,
          customerNameSnapshot: settled.customerNameSnapshot,
          addressTextSnapshot: settled.addressTextSnapshot,
          latitudeSnapshot: settled.latitudeSnapshot,
          longitudeSnapshot: settled.longitudeSnapshot,
          quantitySnapshot: settled.quantitySnapshot,
          estimatedArrival: settled.estimatedArrival,
          actualArrival: settled.actualArrival,
          deliveredAt: settled.deliveredAt,
          plannedDistanceFromPreviousKm: settled.plannedDistanceFromPreviousKm,
          plannedDurationFromPreviousMinutes: settled.plannedDurationFromPreviousMinutes,
          status: settled.status,
          failureReason: settled.failureReason,
        },
      });
    }

    await insertRouteStops(tx, created.id, result, ordersById, settledStops.length + 1);

    if (created.status === "IN_PROGRESS") {
      await tx.order.updateMany({
        where: { id: { in: additionalOrderIds } },
        data: { status: "OUT_FOR_DELIVERY" },
      });
    }

    // Supersede the old plan — its completed-stop history lives on in
    // the new revision's carried-over rows.
    await tx.route.update({ where: { id: current.id }, data: { status: "CANCELLED" } });

    return created;
  });

  await recordAudit({
    action: "ROUTE_REOPTIMIZED",
    entityType: "Route",
    entityId: newRoute.id,
    actorUserId,
    metadata: { previousRouteId: current.id, carriedOverStops: settledStops.length, newStops: result.stops.length },
  });

  return getRouteDetail(newRoute.id);
}

export async function getActiveRouteForDate(dateString: string) {
  return db.route.findFirst({
    where: { date: businessDateOnlyToDate(dateString), status: { in: ["PLANNED", "IN_PROGRESS"] } },
    orderBy: { revisionNumber: "desc" },
    include: {
      stops: {
        orderBy: { stopNumber: "asc" },
        include: { order: { include: { customer: true, address: true } } },
      },
      driver: true,
    },
  });
}

export async function listRoutableOrdersForDate(dateString: string) {
  return db.order.findMany({
    where: {
      deliveryDate: businessDateOnlyToDate(dateString),
      status: "CONFIRMED",
      routeStops: { none: { route: { status: { in: ["PLANNED", "IN_PROGRESS"] } } } },
      address: { latitude: { not: null }, longitude: { not: null } },
    },
    include: { customer: true, address: true },
    orderBy: { createdAt: "asc" },
  });
}
