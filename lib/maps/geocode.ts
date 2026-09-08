import type { MapsResult, ResolvedLocation } from "@/lib/maps/types";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const FETCH_TIMEOUT_MS = 8000;

/**
 * Free, no-key geocoder (Nominatim / OpenStreetMap). Defaults to the
 * public server; set NOMINATIM_BASE_URL to a self-hosted instance for
 * heavy use. Nominatim's usage policy requires a descriptive User-Agent.
 */
function nominatimBaseUrl(): string {
  return (process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
}
const NOMINATIM_HEADERS = { "User-Agent": "GauBhoomiNaturals-Delivery/1.0" };

interface GeocodeApiResult {
  formatted_address: string;
  place_id: string;
  geometry: { location: { lat: number; lng: number } };
  address_components: Array<{ long_name: string; types: string[] }>;
}

function extractArea(components: GeocodeApiResult["address_components"]): string | undefined {
  const sublocality = components.find((c) => c.types.includes("sublocality") || c.types.includes("sublocality_level_1"));
  if (sublocality) return sublocality.long_name;
  const locality = components.find((c) => c.types.includes("locality"));
  return locality?.long_name;
}

function isGoogleConfigured(): boolean {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  return Boolean(key) && key !== "placeholder";
}

async function fetchWithTimeout(url: string, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- Nominatim (free, no key) ----------

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

function nominatimArea(address?: Record<string, string>): string | undefined {
  if (!address) return undefined;
  return (
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.town ||
    address.village ||
    address.city
  );
}

async function geocodeViaNominatim(address: string): Promise<MapsResult<ResolvedLocation>> {
  const url = `${nominatimBaseUrl()}/search?q=${encodeURIComponent(address)}&format=jsonv2&limit=1&countrycodes=in&addressdetails=1`;
  try {
    const res = await fetchWithTimeout(url, NOMINATIM_HEADERS);
    if (!res.ok) {
      return { ok: false, code: "UPSTREAM_ERROR", message: `Geocoding service returned ${res.status}` };
    }
    const data = (await res.json()) as NominatimResult[];
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, code: "ZERO_RESULTS", message: "No location found for that address" };
    }
    const r = data[0];
    return {
      ok: true,
      data: {
        formattedAddress: r.display_name,
        latitude: Number(r.lat),
        longitude: Number(r.lon),
        area: nominatimArea(r.address),
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, code: "TIMEOUT", message: "Geocoding request timed out" };
    }
    return { ok: false, code: "UPSTREAM_ERROR", message: error instanceof Error ? error.message : "Geocoding request failed" };
  }
}

async function reverseViaNominatim(latitude: number, longitude: number): Promise<MapsResult<ResolvedLocation>> {
  const url = `${nominatimBaseUrl()}/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`;
  try {
    const res = await fetchWithTimeout(url, NOMINATIM_HEADERS);
    if (!res.ok) {
      return { ok: false, code: "UPSTREAM_ERROR", message: `Reverse geocoding returned ${res.status}` };
    }
    const r = (await res.json()) as NominatimResult & { error?: string };
    if (r.error || !r.display_name) {
      return { ok: false, code: "ZERO_RESULTS", message: "No address found for that location" };
    }
    return {
      ok: true,
      data: {
        formattedAddress: r.display_name,
        latitude,
        longitude,
        area: nominatimArea(r.address),
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, code: "TIMEOUT", message: "Reverse geocoding request timed out" };
    }
    return { ok: false, code: "UPSTREAM_ERROR", message: error instanceof Error ? error.message : "Reverse geocoding request failed" };
  }
}

// ---------- Google (used only when a key is configured) ----------

async function geocodeViaGoogle(address: string): Promise<MapsResult<ResolvedLocation>> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY!;
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&region=in&key=${apiKey}`;
  try {
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    if (data.status === "ZERO_RESULTS") {
      return { ok: false, code: "ZERO_RESULTS", message: "No location found for that address" };
    }
    if (data.status !== "OK") {
      return { ok: false, code: "REQUEST_DENIED", message: data.error_message ?? `Geocoding API returned ${data.status}` };
    }
    const result: GeocodeApiResult = data.results[0];
    return {
      ok: true,
      data: {
        formattedAddress: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId: result.place_id,
        area: extractArea(result.address_components),
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, code: "TIMEOUT", message: "Geocoding request timed out" };
    }
    return { ok: false, code: "UPSTREAM_ERROR", message: error instanceof Error ? error.message : "Geocoding request failed" };
  }
}

async function reverseViaGoogle(latitude: number, longitude: number): Promise<MapsResult<ResolvedLocation>> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY!;
  const url = `${GEOCODE_URL}?latlng=${latitude},${longitude}&key=${apiKey}`;
  try {
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    if (data.status === "ZERO_RESULTS") {
      return { ok: false, code: "ZERO_RESULTS", message: "No address found for that location" };
    }
    if (data.status !== "OK") {
      return { ok: false, code: "REQUEST_DENIED", message: data.error_message ?? `Geocoding API returned ${data.status}` };
    }
    const result: GeocodeApiResult = data.results[0];
    return {
      ok: true,
      data: {
        formattedAddress: result.formatted_address,
        latitude,
        longitude,
        placeId: result.place_id,
        area: extractArea(result.address_components),
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, code: "TIMEOUT", message: "Reverse geocoding request timed out" };
    }
    return { ok: false, code: "UPSTREAM_ERROR", message: error instanceof Error ? error.message : "Reverse geocoding request failed" };
  }
}

// ---------- Public API: Google when keyed, otherwise free Nominatim ----------

/** Forward geocode: free-text address -> normalized location. */
export function geocodeAddress(address: string): Promise<MapsResult<ResolvedLocation>> {
  return isGoogleConfigured() ? geocodeViaGoogle(address) : geocodeViaNominatim(address);
}

/** Reverse geocode: coordinates -> a human-readable address (for manual pin-drop display). */
export function reverseGeocode(latitude: number, longitude: number): Promise<MapsResult<ResolvedLocation>> {
  return isGoogleConfigured() ? reverseViaGoogle(latitude, longitude) : reverseViaNominatim(latitude, longitude);
}
