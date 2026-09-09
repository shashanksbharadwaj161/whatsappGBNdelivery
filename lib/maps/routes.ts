import { distanceOptimizedOrder } from "./distance-order";
import { z } from "zod";
import { nearestNeighborOrder, twoOptImprove, haversineDistanceKm } from "@/lib/geo/haversine";
import { UpstreamError, ValidationError } from "@/lib/errors";

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const MAX_WAYPOINTS = 25;
/** Assumed average urban speed for the straight-line fallback's ETA estimate. */
const DEV_FALLBACK_AVG_SPEED_KMH = 22;

/**
 * Free, no-key road-routing provider (OSRM). Defaults to the public demo
 * server, which is fine for one driver's handful of daily route
 * calculations; set OSRM_BASE_URL to a self-hosted instance for heavy
 * use. Road distance matrices determine stop order; the route service
 * returns driving distances and durations.
 */
function osrmBaseUrl(): string {
  return (process.env.OSRM_BASE_URL || "https://router.project-osrm.org").replace(/\/$/, "");
}
const OSRM_FETCH_TIMEOUT_MS = 12000;

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

async function optimizeViaOsrm(
  origin: { lat: number; lng: number }, waypoints: RouteWaypoint[], startTime: Date, roundTrip = true
): Promise<OptimizeRouteResult> {
  const points = [origin, ...waypoints];
  const coords = points.map(c => `${c.lng},${c.lat}`).join(";");
  const matrixResponse = await fetch(`${osrmBaseUrl()}/table/v1/driving/${coords}?annotations=distance`, { signal: AbortSignal.timeout(OSRM_FETCH_TIMEOUT_MS) });
  const matrix = z.object({ code: z.literal("Ok"), distances: z.array(z.array(z.number().nonnegative())) }).safeParse(await matrixResponse.json());
  if (!matrixResponse.ok || !matrix.success || matrix.data.distances.length !== points.length) throw new UpstreamError("Road distances could not be calculated for every stop");
  const order = distanceOptimizedOrder(matrix.data.distances, roundTrip);
  const path = [origin, ...order.map(i => points[i]), ...(roundTrip ? [origin] : [])];
  const response = await fetch(`${osrmBaseUrl()}/route/v1/driving/${path.map(c => `${c.lng},${c.lat}`).join(";")}?overview=false&steps=false`, { signal: AbortSignal.timeout(OSRM_FETCH_TIMEOUT_MS) });
  const parsed = z.object({ code: z.literal("Ok"), routes: z.array(z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative(), legs: z.array(z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative() })) })).min(1) }).safeParse(await response.json());
  if (!response.ok || !parsed.success) throw new UpstreamError("The road route could not be calculated");
  const route = parsed.data.routes[0];
  if (route.legs.length !== path.length - 1) throw new UpstreamError("Road route did not include every stop");
  let arrival = startTime.getTime();
  const stops = order.map((pointIndex, sequenceIndex) => {
    const leg = route.legs[sequenceIndex]; arrival += leg.duration * 1000;
    return { id: waypoints[pointIndex - 1].id, sequenceIndex, distanceFromPreviousKm: leg.distance / 1000, durationFromPreviousMinutes: leg.duration / 60, estimatedArrival: new Date(arrival) };
  });
  return { stops, totalDistanceKm: route.distance / 1000, totalDurationMinutes: route.duration / 60, usedDevFallback: false };
}

/** Straight-line nearest-neighbor ordering — last-resort estimate when no road-routing provider is reachable. */
function optimizeViaHaversineFallback(
  origin: { lat: number; lng: number },
  waypoints: RouteWaypoint[],
  startTime: Date,
  roundTrip = true
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

  const returnDistanceKm = roundTrip ? haversineDistanceKm(previous, origin) : 0;
  totalDistanceKm += returnDistanceKm;
  totalDurationMinutes += (returnDistanceKm / DEV_FALLBACK_AVG_SPEED_KMH) * 60;

  return { stops, totalDistanceKm, totalDurationMinutes, usedDevFallback: true };
}

/**
 * One-driver route optimization, in provider priority order:
 *   1. Google Routes API — when GOOGLE_MAPS_SERVER_API_KEY is set.
 *   2. OSRM distance matrix and route — free, no key, real road distances (the default).
 *   3. Straight-line nearest-neighbor + 2-opt — last resort if OSRM is
 *      unreachable, flagged usedDevFallback so the UI can say the ETAs
 *      are estimates rather than road data.
 * Return to the starting point is optional.
 */
export async function optimizeRoute(
  origin: { lat: number; lng: number },
  waypoints: RouteWaypoint[],
  startTime: Date,
  roundTrip = true
): Promise<OptimizeRouteResult> {
  if (waypoints.length === 0) {
    throw new ValidationError("At least one stop is required to optimize a route");
  }
  if (waypoints.length > MAX_WAYPOINTS) {
    throw new ValidationError(`Route optimization supports at most ${MAX_WAYPOINTS} stops at a time`);
  }

  if (isMapsKeyConfigured() && roundTrip) {
    return optimizeViaGoogleRoutesApi(origin, waypoints, startTime);
  }

  try {
    return await optimizeViaOsrm(origin, waypoints, startTime, roundTrip);
  } catch (error) {
    console.warn(
      `[routing] OSRM unavailable (${error instanceof Error ? error.message : "unknown error"}) — falling back to straight-line estimate.`
    );
    return optimizeViaHaversineFallback(origin, waypoints, startTime, roundTrip);
  }
}
