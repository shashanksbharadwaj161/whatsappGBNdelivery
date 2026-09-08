# Google Maps setup

The app uses three Google Maps Platform APIs:

- **Places API** — address autocomplete in the order form (browser).
- **Geocoding API** — turning typed addresses / pasted Maps links into
  coordinates, and coordinates back into a readable address (server).
- **Routes API** — one-driver route optimization (`computeRoutes` with
  `optimizeWaypointOrder`) (server).

You need **two separate API keys** — one restricted for browser use, one
for server use — because they need different restrictions and quotas.

## 1. Create a Google Cloud project and enable billing

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a new project (or pick an existing one).
2. Under **Billing**, attach a billing account. Google Maps Platform
   requires billing to be enabled even within the free tier.

## 2. Enable the required APIs

In **APIs & Services → Library**, enable:

- Maps JavaScript API
- Places API
- Geocoding API
- Routes API

## 3. Create the browser key

1. **APIs & Services → Credentials → Create Credentials → API key.**
2. Rename it to something like `gbn-browser-key`.
3. Click **Edit API key**:
   - **Application restrictions**: HTTP referrers → add your domain(s),
     e.g. `https://your-app.vercel.app/*` and `http://localhost:3000/*`
     for local dev.
   - **API restrictions**: restrict to *Maps JavaScript API* and
     *Places API* only.
4. Copy the key into `.env.local` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

This key is exposed to the browser (it has to be, to load the map) —
the HTTP-referrer restriction is what keeps it from being usable
elsewhere.

## 4. Create the server key

1. **Create Credentials → API key** again.
2. Rename it `gbn-server-key`.
3. **API restrictions**: restrict to *Geocoding API* and *Routes API*
   only. Application restrictions can be left off, or set to IP
   addresses if your hosting has a stable outbound IP.
4. Copy the key into `.env.local` (and your Vercel project's env vars)
   as `GOOGLE_MAPS_SERVER_API_KEY`. **Never** prefix this one with
   `NEXT_PUBLIC_` — it must stay server-only.

## 5. Everything here is OPTIONAL — the app is free by default

**You do not need a Google Maps account at all.** With no
`GOOGLE_MAPS_SERVER_API_KEY` set, the app uses free, no-key services:

- **Route optimization** runs on **OSRM's public `/trip` server** — real
  road-based waypoint ordering with distances and ETAs, no key. If OSRM
  is momentarily unreachable, that one optimize falls back to a clearly-
  labeled straight-line estimate and uses road data again next time.
  (For heavy use you can self-host OSRM and point `OSRM_BASE_URL` at it.)
- **Geocoding** (typed address → coordinates) runs on
  **Nominatim / OpenStreetMap**, no key. You can also just drop the pin
  on the map manually, which needs no geocoding at all.
- Set `GOOGLE_MAPS_SERVER_API_KEY` only if you specifically prefer
  Google's Routes/Geocoding APIs — the app switches to Google
  automatically when the key is present.
- **Interactive maps also work with no key at all.** The route map,
  the driver's delivery map and the order/settings pin-drop render via
  Leaflet + OpenStreetMap (no API key) whenever
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is unset, so delivery locations are
  always visible. Set the browser key only if you specifically prefer
  Google's map tiles/Places Autocomplete — the app switches to Google
  automatically when the key is present. (Map tiles need public
  internet to load; the pins and route line render either way.)

## 6. Setting the base/depot location

Once the app is running, go to **Settings → Default delivery start
location** and drop a pin (or type coordinates) at the actual farm/store
location — this is stored in the database, not hardcoded, and is used
as the default starting point for route optimization.

## 7. Budget

Typical MVP volumes (a few dozen orders/day, one route optimization per
day) stay comfortably within the $200/month free credit Google Maps
Platform provides. Set a budget alert in **Billing → Budgets & alerts**
regardless.
