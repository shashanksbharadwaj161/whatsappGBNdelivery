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
 * use. Its /trip service solves the one-vehicle TSP and returns real
 * road distances/durations.
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

const osrmTripResponseSchema = z.object({
  code: z.string(),
  trips: z
    .array(
      z.object({
        distance: z.number(), // meters, whole roundtrip
        duration: z.number(), // seconds, whole roundtrip
        legs: z.array(z.object({ distance: z.number(), duration: z.number() })),
      })
    )
    .optional(),
  waypoints: z.array(z.object({ waypoint_index: z.number() })).optional(),
});

/**
 * Free road-based optimization via OSRM's /trip service (no API key).
 * Depot is the first coordinate (source=first) and the driver returns to
 * it (roundtrip=true). Returns real road distances/durations.
 */
async function optimizeViaOsrm(
  origin: { lat: number; lng: number },
  waypoints: RouteWaypoint[],
  startTime: Date
): Promise<OptimizeRouteResult> {
  // OSRM coordinate order is lng,lat. Depot first, then the stops.
  const coords = [origin, ...waypoints.map((w) => ({ lat: w.lat, lng: w.lng }))]
    .map((c) => `${c.lng},${c.lat}`)
    .join(";");
  const url = `${osrmBaseUrl()}/trip/v1/driving/${coords}?source=first&roundtrip=true&overview=false&annotations=false`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "GauBhoomiNaturals-Delivery/1.0" } });
  } finally {
    clearTimeout(timeout);
  }

  const raw = await res.json().catch(() => null);
  const parsed = osrmTripResponseSchema.safeParse(raw);
  if (!res.ok || !parsed.success || parsed.data.code !== "Ok" || !parsed.data.trips?.length || !parsed.data.waypoints) {
    throw new UpstreamError(`OSRM routing returned an unexpected response (${raw?.code ?? res.status})`);
  }

  const trip = parsed.data.trips[0];
  const respWaypoints = parsed.data.waypoints;
  const expectedCount = waypoints.length + 1;
  if (respWaypoints.length !== expectedCount || trip.legs.length !== expectedCount) {
    throw new UpstreamError("OSRM routing response did not match the number of waypoints sent");
  }

  // waypoint_index gives each input coordinate's position in the optimized
  // trip. Depot (input 0) is position 0; sort the real stops by position.
  const ordered = [...waypoints]
    .map((wp, i) => ({ wp, position: respWaypoints[i + 1].waypoint_index }))
    .sort((a, b) => a.position - b.position);

  const stops: OptimizedStop[] = [];
  let cumulativeMs = startTime.getTime();

  ordered.forEach((entry, seq) => {
    // Leg into optimized position `position` is legs[position - 1].
    const leg = trip.legs[entry.position - 1];
    const distanceKm = leg.distance / 1000;
    const durationMinutes = leg.duration / 60;
    cumulativeMs += durationMinutes * 60 * 1000;
    stops.push({
      id: entry.wp.id,
      sequenceIndex: seq,
      distanceFromPreviousKm: distanceKm,
      durationFromPreviousMinutes: durationMinutes,
      estimatedArrival: new Date(cumulativeMs),
    });
  });

  // Trip totals already include the closing leg back to the depot.
  return {
    stops,
    totalDistanceKm: trip.distance / 1000,
    totalDurationMinutes: trip.duration / 60,
    usedDevFallback: false,
  };
}

/** Straight-line nearest-neighbor ordering — last-resort estimate when no road-routing provider is reachable. */
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
 * One-driver route optimization, in provider priority order:
 *   1. Google Routes API — when GOOGLE_MAPS_SERVER_API_KEY is set.
 *   2. OSRM /trip — free, no key, real road distances (the default).
 *   3. Straight-line nearest-neighbor + 2-opt — last resort if OSRM is
 *      unreachable, flagged usedDevFallback so the UI can say the ETAs
 *      are estimates rather than road data.
 * Every path returns to the depot (round trip).
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

  try {
    return await optimizeViaOsrm(origin, waypoints, startTime);
  } catch (error) {
    console.warn(
      `[routing] OSRM unavailable (${error instanceof Error ? error.message : "unknown error"}) — falling back to straight-line estimate.`
    );
    return optimizeViaHaversineFallback(origin, waypoints, startTime);
  }
}
