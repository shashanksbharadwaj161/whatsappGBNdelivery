import { db } from "@/lib/db";
import { haversineDistanceKm } from "@/lib/geo/haversine";
import { businessDateOnlyToDate } from "@/lib/tz";

export interface DeliveryEconomics {
  existingStopCount: number;
  nearestStopKm: number;
}

/**
 * Lightweight heuristic — straight-line distance to the nearest already-
 * confirmed stop for that delivery date. Not a real route re-optimize
 * (that's a full computeRoutes call, too heavy to run on every order
 * form edit); good enough to flag an order that's clearly outside
 * today's delivery zone before it's added to the route.
 */
export async function computeDeliveryEconomics(
  latitude: number,
  longitude: number,
  deliveryDateString: string
): Promise<DeliveryEconomics | null> {
  const existingStops = await db.order.findMany({
    where: {
      deliveryDate: businessDateOnlyToDate(deliveryDateString),
      status: { in: ["CONFIRMED", "OUT_FOR_DELIVERY"] },
      address: { latitude: { not: null }, longitude: { not: null } },
    },
    include: { address: true },
  });

  if (existingStops.length === 0) return null;

  const distances = existingStops.map((o) =>
    haversineDistanceKm({ lat: latitude, lng: longitude }, { lat: o.address.latitude!, lng: o.address.longitude! })
  );

  return {
    existingStopCount: existingStops.length,
    nearestStopKm: Math.min(...distances),
  };
}
