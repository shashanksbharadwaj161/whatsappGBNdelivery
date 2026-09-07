import type { MapsResult, ResolvedLocation } from "@/lib/maps/types";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const FETCH_TIMEOUT_MS = 8000;

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

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Forward geocode: free-text address -> normalized location. */
export async function geocodeAddress(address: string): Promise<MapsResult<ResolvedLocation>> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    return { ok: false, code: "NO_API_KEY", message: "GOOGLE_MAPS_SERVER_API_KEY is not configured" };
  }

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

/** Reverse geocode: coordinates -> a human-readable address (for manual pin-drop display). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<MapsResult<ResolvedLocation>> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    return { ok: false, code: "NO_API_KEY", message: "GOOGLE_MAPS_SERVER_API_KEY is not configured" };
  }

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
