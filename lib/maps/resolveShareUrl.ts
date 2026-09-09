import type { MapsResult, ResolvedLocation } from "@/lib/maps/types";
import { geocodeAddress, reverseGeocode } from "@/lib/maps/geocode";

const ALLOWED_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "google.com", "www.google.com", "maps.google.com"]);
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 6000;
const MAX_RESPONSE_BYTES = 512 * 1024;

function isAllowedHost(url: URL): boolean {
  return ALLOWED_HOSTS.has(url.hostname);
}

/** Pulls lat/lng straight out of a Google Maps URL, no network call. */
function extractCoordinatesFromUrl(url: URL): { lat: number; lng: number } | null {
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // place URLs with a pin: !3dLAT!4dLNG
  ];
  for (const pattern of patterns) {
    const match = url.pathname.match(pattern) ?? url.href.match(pattern);
    if (match && Math.abs(Number(match[1]))<=90 && Math.abs(Number(match[2]))<=180) return { lat: Number(match[1]), lng: Number(match[2]) };
  }

  const q = url.searchParams.get("q") ?? url.searchParams.get("query");
  if (q) {
    const qMatch = q.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/);
    if (qMatch) return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
  }

  const ll = url.searchParams.get("ll");
  if (ll) {
    const llMatch = ll.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/);
    if (llMatch) return { lat: Number(llMatch[1]), lng: Number(llMatch[2]) };
  }

  return null;
}

function extractPlaceQuery(url: URL): string | null {
  const q = url.searchParams.get("q") ?? url.searchParams.get("query");
  if (q && !/^-?\d+\.\d+,-?\d+\.\d+$/.test(q)) return decodeURIComponent(q.replace(/\+/g, " "));

  // /maps/place/<Name>/... URLs
  const placeMatch = url.pathname.match(/\/maps\/place\/([^/]+)/);
  if (placeMatch) return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));

  return null;
}

/**
 * Resolves a Google Maps URL (full or shortened) to coordinates. SSRF
 * guard: only ever fetches a URL whose host is in ALLOWED_HOSTS, and
 * re-validates every redirect hop against the same allowlist before
 * following it — this endpoint takes arbitrary WhatsApp-pasted text, so
 * it's a real SSRF surface, not a theoretical one.
 */
export async function resolveGoogleMapsUrl(rawUrl: string): Promise<MapsResult<ResolvedLocation>> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, code: "INVALID_URL", message: "Not a valid URL" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, code: "INVALID_URL", message: "Only http(s) URLs are supported" };
  }
  if (!isAllowedHost(url)) {
    return { ok: false, code: "INVALID_URL", message: "Only Google Maps links are supported" };
  }

  const directCoords = extractCoordinatesFromUrl(url);
  if (directCoords) {
    const reverse = await reverseGeocode(directCoords.lat, directCoords.lng);
    if (reverse.ok) return reverse;
    return {
      ok: true,
      data: { formattedAddress: `${directCoords.lat}, ${directCoords.lng}`, latitude: directCoords.lat, longitude: directCoords.lng },
    };
  }

  // Shortened link (or a place URL with no embedded pin) — follow
  // redirects manually, re-checking the allowlist at every hop.
  let currentUrl = url;
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(currentUrl, { redirect: "manual", signal: controller.signal });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof DOMException && error.name === "AbortError") {
        return { ok: false, code: "TIMEOUT", message: "Timed out resolving the Maps link" };
      }
      return { ok: false, code: "UPSTREAM_ERROR", message: "Could not reach the Maps link" };
    }
    clearTimeout(timeout);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        break;
      }
      if (!isAllowedHost(nextUrl)) {
        return { ok: false, code: "INVALID_URL", message: "Redirect left the allowed Google Maps hosts" };
      }
      const coords = extractCoordinatesFromUrl(nextUrl);
      if (coords) {
        const reverse = await reverseGeocode(coords.lat, coords.lng);
        if (reverse.ok) return reverse;
        return {
          ok: true,
          data: { formattedAddress: `${coords.lat}, ${coords.lng}`, latitude: coords.lat, longitude: coords.lng },
        };
      }
      currentUrl = nextUrl;
      continue;
    }

    // Final response — read a capped amount of the body in case the
    // coordinates are only present in an HTML redirect/meta refresh.
    const reader = res.body?.getReader();
    let text = "";
    if (reader) {
      let received = 0;
      while (received < MAX_RESPONSE_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        text += Buffer.from(value).toString("utf8");
      }
      reader.cancel().catch(() => {});
    }
    const bodyCoordsMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (bodyCoordsMatch) {
      const lat = Number(bodyCoordsMatch[1]);
      const lng = Number(bodyCoordsMatch[2]);
      const reverse = await reverseGeocode(lat, lng);
      if (reverse.ok) return reverse;
      return { ok: true, data: { formattedAddress: `${lat}, ${lng}`, latitude: lat, longitude: lng } };
    }

    const placeQuery = extractPlaceQuery(currentUrl);
    if (placeQuery) {
      return geocodeAddress(placeQuery);
    }

    break;
  }

  const placeQuery = extractPlaceQuery(url);
  if (placeQuery) return geocodeAddress(placeQuery);

  return { ok: false, code: "UNRESOLVED_URL", message: "Could not extract a location from this link — try pinning it manually" };
}
