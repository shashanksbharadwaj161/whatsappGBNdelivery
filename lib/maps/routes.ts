import { z } from "zod";
import { nearestNeighborOrder, twoOptImprove, haversineDistanceKm } from "@/lib/geo/haversine";
import { UpstreamError, ValidationError } from "@/lib/errors";

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const MAX_WAYPOINTS = 25;
/** Assumed average urban speed for the dev-only haversine fallback's ETA estimate. */
const DEV_FALLBACK_AVG_SPEED_KMH = 22;

export interface RouteWaypoint {
  id: string;
  lat: number;
  lng: number;
}

export interface OptimizedStop {
  id: string;
  sequenceIndex: number;
  distanceFromPreviousKm: number;
  durationFromPreviousMinutes: number;
  estimatedArrival: Date;
}

export interface OptimizeRouteResult {
  stops: OptimizedStop[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  usedDevFallback: boolean;
}

const PLACEHOLDER_KEYS = new Set(["", "your-google-maps-server-key", "placeholder"]);

function isMapsKeyConfigured(): boolean {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  return Boolean(key) && !PLACEHOLDER_KEYS.has(key ?? "");
}

const computeRoutesResponseSchema = z.object({
  routes: z
    .array(
      z.object({
        optimizedIntermediateWaypointIndex: z.array(z.number()).optional(),
        legs: z.array(
          z.object({
            duration: z.string(), // e.g. "312s"
            distanceMeters: z.number(),
          })
        ),
      })
    )
    .min(1),
});

function parseDurationSeconds(duration: string): number {
  return Number(duration.replace(/s$/, ""));
}

async function optimizeViaGoogleRoutesApi(
  origin: { lat: number; lng: number },
  waypoints: RouteWaypoint[],
  startTime: Date
): Promise<OptimizeRouteResult> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY!;

  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    intermediates: waypoints.map((w) => ({ location: { latLng: { latitude: w.lat, longitude: w.lng } } })),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    optimizeWaypointOrder: true,
  };

  let res: Response;
  try {
    res = await fetch(ROUTES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new UpstreamError(error instanceof Error ? error.message : "Could not reach the Google Routes API");
  }

  const rawData = await res.json().catch(() => null);
  if (!res.ok || !rawData) {
    throw new UpstreamError(rawData?.error?.message ?? `Google Routes API returned ${res.status}`);
  }

  const parsed = computeRoutesResponseSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new UpstreamError("Google Routes API returned an unexpected response shape");
  }

  const route = parsed.data.routes[0];
  const order = route.optimizedIntermediateWaypointIndex ?? waypoints.map((_, i) => i);

  if (order.length !== waypoints.length || route.legs.length !== waypoints.length + 1) {
    throw new UpstreamError("Google Routes API response did not match the number of waypoints sent");
  }

  const stops: OptimizedStop[] = [];
  let cumulativeMs = startTime.getTime();
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;

  for (let i = 0; i < order.length; i++) {
    const leg = route.legs[i]; // leg from previous stop (or origin) to this stop
    const distanceKm = leg.distanceMeters / 1000;
    const durationMinutes = parseDurationSeconds(leg.duration) / 60;
    cumulativeMs += durationMinutes * 60 * 1000;
    totalDistanceKm += distanceKm;
    totalDurationMinutes += durationMinutes;

    stops.push({
      id: waypoints[order[i]].id,
      sequenceIndex: i,
      distanceFromPreviousKm: distanceKm,
      durationFromPreviousMinutes: durationMinutes,
      estimatedArrival: new Date(cumulativeMs),
    });
  }

  // Final leg back to the depot — counted in the route total, not attached to a stop.
  const returnLeg = route.legs[route.legs.length - 1];
  totalDistanceKm += returnLeg.distanceMeters / 1000;
  totalDurationMinutes += parseDurationSeconds(returnLeg.duration) / 60;

  return { stops, totalDistanceKm, totalDurationMinutes, usedDevFallback: false };
}

/** Straight-line nearest-neighbor ordering — dev-only, never used when a real key is configured. */
function optimizeViaHaversineFallback(
  origin: { lat: number; lng: number },
  waypoints: RouteWaypoint[],
  startTime: Date
): OptimizeRouteResult {
  const ordered = twoOptImprove(origin, nearestNeighborOrder(origin, waypoints));

  const stops: OptimizedStop[] = [];
  let cumulativeMs = startTime.getTime();
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  let previous = origin;

  ordered.forEach((point, i) => {
    const distanceKm = haversineDistanceKm(previous, point);
    const durationMinutes = (distanceKm / DEV_FALLBACK_AVG_SPEED_KMH) * 60;
    cumulativeMs += durationMinutes * 60 * 1000;
    totalDistanceKm += distanceKm;
    totalDurationMinutes += durationMinutes;

    stops.push({
      id: point.id,
      sequenceIndex: i,
      distanceFromPreviousKm: distanceKm,
      durationFromPreviousMinutes: durationMinutes,
      estimatedArrival: new Date(cumulativeMs),
    });
    previous = point;
  });

  const returnDistanceKm = haversineDistanceKm(previous, origin);
  totalDistanceKm += returnDistanceKm;
  totalDurationMinutes += (returnDistanceKm / DEV_FALLBACK_AVG_SPEED_KMH) * 60;

  return { stops, totalDistanceKm, totalDurationMinutes, usedDevFallback: true };
}

/**
 * One-driver route optimization. Uses the real Google Routes API
 * (`computeRoutes` with `optimizeWaypointOrder`) when a key is
 * configured. Without one, falls back to straight-line nearest-neighbor
 * ordering ONLY outside production — a broken key in production must
 * fail loudly rather than silently produce a deceptively "valid" route.
 */
export async function optimizeRoute(
  origin: { lat: number; lng: number },
  waypoints: RouteWaypoint[],
  startTime: Date
): Promise<OptimizeRouteResult> {
  if (waypoints.length === 0) {
    throw new ValidationError("At least one stop is required to optimize a route");
  }
  if (waypoints.length > MAX_WAYPOINTS) {
    throw new ValidationError(`Route optimization supports at most ${MAX_WAYPOINTS} stops at a time`);
  }

  if (isMapsKeyConfigured()) {
    return optimizeViaGoogleRoutesApi(origin, waypoints, startTime);
  }

  if (process.env.NODE_ENV === "production") {
    throw new UpstreamError(
      "GOOGLE_MAPS_SERVER_API_KEY is not configured — route optimization cannot run in production without it."
    );
  }

  console.warn(
    "[dev-fallback] No GOOGLE_MAPS_SERVER_API_KEY configured — using straight-line nearest-neighbor routing for local development only."
  );
  return optimizeViaHaversineFallback(origin, waypoints, startTime);
}
