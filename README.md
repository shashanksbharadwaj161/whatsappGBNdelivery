# Gau Bhoomi Naturals — Delivery Dashboard

A WhatsApp-order-to-delivery-route management app for Gau Bhoomi
Naturals, a Bengaluru A2 milk delivery business with one driver and one
vehicle.

Core loop: **WhatsApp message → Order → Resolved location → Optimized
route → Delivered**, with everything in between (customers, addresses,
subscriptions, analytics, a driver-facing mobile view) built to support
that loop, not to distract from it.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **PostgreSQL** via **Prisma 7** (driver-adapter based — pooled
  connection at runtime, direct connection for migrations)
- **Supabase Auth** (email/password, two roles: `OWNER`, `DRIVER`)
- **Google Maps Platform**: Places Autocomplete, Geocoding API, Routes
  API (`computeRoutes` + `optimizeWaypointOrder`) for real one-driver
  route optimization
- **Meta WhatsApp Cloud API** (official, no scraping libraries) for the
  Inbox and order intake

## Getting started locally

```bash
npm install
cp .env.example .env.local   # fill in real values, or see below for a no-credentials dev setup
npx prisma migrate dev       # creates the schema
npm run db:seed              # optional: sample Bengaluru-area customers/orders
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running without any live credentials

Every external integration in this app degrades honestly instead of
faking success when it isn't configured:

- **No `GOOGLE_MAPS_SERVER_API_KEY`**: route optimization uses a
  clearly-labeled dev-only straight-line (haversine) fallback instead of
  the real Google Routes API. This only applies outside production —
  with `NODE_ENV=production` and no key, route optimization refuses to
  run rather than silently producing an inaccurate "optimized" route.
- **No `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`**: Places Autocomplete and the
  interactive pin-drop map degrade to plain text/numeric inputs with an
  explanatory note, rather than a broken widget.
- **No `WHATSAPP_ACCESS_TOKEN`**: outbound WhatsApp sends fail against
  the real Graph API and are recorded as `FAILED` (visible in the
  Inbox, logged to the audit trail) — never silently dropped or faked
  as sent.
- **No Supabase project**: `requireRole()` fails closed (rejects, never
  grants access) on every API route and server action even without a
  configured auth backend — see "Verifying the app works" below for how
  to exercise the business logic in that case.

This means you can develop and demo the entire order → route →
delivery flow with just a local Postgres database and no external
accounts, then add real credentials later without changing any code —
see `docs/google-maps-setup.md`, `docs/whatsapp-setup.md` and
`docs/deployment.md` for wiring up the real thing.

## Verifying the app works

Two scripts exercise the full core loop against a real database (used
during development in place of browser-based auth testing, since that
needs a live Supabase project):

```bash
npm run dev                    # in one terminal
npm run verify:webhook         # POSTs one signed, Meta-shaped webhook payload
npm run verify:traceability    # walks it through order -> confirm -> route -> deliver,
                                # asserting real DB state at every step
```

## Project structure

```
app/
  (auth)/login                Supabase email/password sign-in
  (dashboard)/                Owner-only: Dashboard, Inbox, Orders, Routes,
                               Customers, Analytics, Settings
  driver/                     Mobile-first driver view (owner or driver role)
  api/
    webhooks/whatsapp         Meta webhook (GET verify, POST inbound)
    whatsapp/send             Outbound send (session or template)
    geocode, maps-url/resolve Address normalization
    routes/optimize           Route optimization (+ /[routeId]/start, /reoptimize)
    driver/stops/[id]/status  Delivered / Skipped / Unavailable
    cron/generate-daily-orders  Subscription -> daily order generation
lib/
  services/                   Business logic (the real source of truth)
  actions/                    "use server" wrappers around services, for the UI
  maps/, whatsapp/, geo/      External integrations + the dev-only routing fallback
  auth/guard.ts               requireRole() — checked independently on every
                               API route and server action, not just via middleware
  tz.ts                       Asia/Kolkata is the only timezone that matters for
                               "today"/"tomorrow", delivery dates, and subscription generation
components/                   UI, grouped by feature area
prisma/schema.prisma          Full schema — see inline comments for the less obvious
                               design decisions (nullable Address coordinates,
                               RouteStop snapshots, Route revisions, etc.)
docs/                         Setup guides for Google Maps, WhatsApp, and deployment
scripts/                      Verification scripts (see above)
```

## Design decisions worth knowing about

- **Address coordinates are nullable at the schema level.** A WhatsApp
  lead can exist and chat with no resolved address yet — the guarantee
  that routing needs real coordinates is enforced in application code
  (an order can't move to `CONFIRMED`, and can't be selected for
  routing, without them), not by a blanket `NOT NULL`.
- **`RouteStop` snapshots** the customer name/address/quantity at
  optimize time. If a customer's address changes tomorrow, yesterday's
  completed route doesn't retroactively change.
- **Routes have revisions.** "Add an order and re-optimize" creates a
  new `Route` row (linked via `previousRouteId`) that carries already-
  delivered/skipped stops forward unchanged and only re-orders what's
  still pending — it never rewrites history.
- **All "today"/"tomorrow" logic goes through `lib/tz.ts`**, which is
  hard-pinned to `Asia/Kolkata` — the app runs on infrastructure that is
  itself in UTC, and getting this wrong is exactly the kind of bug that
  only shows up near midnight IST.
- **Every mutating API route and server action calls `requireRole()`
  independently.** Next.js middleware also redirects unauthenticated
  browser navigation, but that's a UX convenience, not the security
  boundary.

## Deploying

See `docs/deployment.md` for the full Vercel + Supabase walkthrough,
and `docs/google-maps-setup.md` / `docs/whatsapp-setup.md` for the
external accounts you'll need.
