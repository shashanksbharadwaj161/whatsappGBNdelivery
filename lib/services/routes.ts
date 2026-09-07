import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { optimizeRoute, type RouteWaypoint } from "@/lib/maps/routes";
import { hasCoordinates } from "@/lib/services/addresses";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { businessDateOnlyToDate } from "@/lib/tz";

export interface CreateRouteInput {
  orderIds: string[];
  startLat: number;
  startLng: number;
  startTime: Date;
  actorUserId?: string;
  driverId?: string;
}

function milkQuantityLabel(order: { milkSize: string; quantity: number; customQuantityLiters: number | null }) {
  const unit = order.milkSize === "ML500" ? "500 ml" : order.milkSize === "L1" ? "1 Litre" : `${order.customQuantityLiters} L`;
  return `${order.quantity}× ${unit}`;
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

  const result = await optimizeRoute({ lat: input.startLat, lng: input.startLng }, waypoints, input.startTime);

  const ordersById = new Map(orders.map((o) => [o.id, o]));

  const route = await db.$transaction(async (tx) => {
    const createdRoute = await tx.route.create({
      data: {
        date: deliveryDate,
        driverId: input.driverId,
        startLocationLat: input.startLat,
        startLocationLng: input.startLng,
        plannedDistanceKm: result.totalDistanceKm,
        plannedDurationMinutes: Math.round(result.totalDurationMinutes),
        status: "PLANNED",
        usedDevFallback: result.usedDevFallback,
        createdByUserId: input.actorUserId,
      },
    });

    for (const stop of result.stops) {
      const order = ordersById.get(stop.id)!;
      await tx.routeStop.create({
        data: {
          routeId: createdRoute.id,
          orderId: order.id,
          stopNumber: stop.sequenceIndex + 1,
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
      routeStop: null,
      address: { latitude: { not: null }, longitude: { not: null } },
    },
    include: { customer: true, address: true },
    orderBy: { createdAt: "asc" },
  });
}
