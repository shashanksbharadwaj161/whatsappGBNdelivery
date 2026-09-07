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
