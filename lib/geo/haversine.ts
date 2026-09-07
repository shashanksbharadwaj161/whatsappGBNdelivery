const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km between two lat/lng points. */
export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/**
 * Straight-line-distance nearest-neighbor ordering, used only as the
 * dev-only route fallback when no Google Maps key is configured (see
 * lib/maps/routes.ts) — never a substitute for real road-distance
 * optimization in production.
 */
export function nearestNeighborOrder<T extends { lat: number; lng: number }>(
  start: { lat: number; lng: number },
  points: T[]
): T[] {
  const remaining = [...points];
  const ordered: T[] = [];
  let current = start;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistanceKm(current, remaining[i]);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next;
  }

  return ordered;
}

function tourLength(start: { lat: number; lng: number }, points: { lat: number; lng: number }[]): number {
  let total = 0;
  let prev = start;
  for (const p of points) {
    total += haversineDistanceKm(prev, p);
    prev = p;
  }
  total += haversineDistanceKm(prev, start); // round trip back to depot
  return total;
}

/**
 * Classic 2-opt local search: repeatedly reverses a segment of the tour
 * if doing so shortens it, until no single reversal helps. Cleans up the
 * "stranded far stop at the end" problem plain nearest-neighbor leaves
 * behind. Still a heuristic, still dev-only — see nearestNeighborOrder.
 */
export function twoOptImprove<T extends { lat: number; lng: number }>(
  start: { lat: number; lng: number },
  points: T[]
): T[] {
  let tour = [...points];
  if (tour.length < 3) return tour;

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < tour.length - 1; i++) {
      for (let j = i + 1; j < tour.length; j++) {
        const candidate = [...tour.slice(0, i), ...tour.slice(i, j + 1).reverse(), ...tour.slice(j + 1)];
        if (tourLength(start, candidate) < tourLength(start, tour) - 1e-9) {
          tour = candidate;
          improved = true;
        }
      }
    }
  }

  return tour;
}
