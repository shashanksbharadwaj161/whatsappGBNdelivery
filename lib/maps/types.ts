export interface ResolvedLocation {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  area?: string;
}

export type MapsResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "NO_API_KEY" | "REQUEST_DENIED" | "ZERO_RESULTS" | "TIMEOUT" | "INVALID_URL" | "UNRESOLVED_URL" | "UPSTREAM_ERROR"; message: string };
