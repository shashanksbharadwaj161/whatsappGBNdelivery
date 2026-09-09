# Render + Supabase

The Next.js web service hosts both the mobile interface and the authenticated APIs. Supabase provides PostgreSQL and Auth.

- Runtime: Node 22, region close to Supabase/users.
- Build: `npm ci && npm run build`
- Start: `npm run db:deploy && npm start`
- Health check: `/api/health` (checks the application schema; returns no credentials or business data).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase project URL and publishable/anon key. These are public client settings, never use a service-role key here.
- Database: either `DATABASE_URL` and optional `DIRECT_URL`, or `PGHOST`, `PGPORT=5432`, `PGDATABASE=postgres`, `PGUSER`, and secret `PGPASSWORD`. Use Supabase's session pooler for IPv4 hosting. Enter the existing database password directly into Render's secret field. The app percent-encodes it in memory.
- Google Maps keys are optional. Maps use OpenStreetMap without them. The authenticated road-preview endpoint uses OSRM and preserves saved stop order; preview failure never prevents delivery actions.
- Set the production URL in Supabase Auth URL Configuration. Create login accounts in Supabase and set their trusted `app_metadata.role` to `OWNER` or `DRIVER`. The server mirrors authorized identities to Profile on the first authorized API/action request.
- Migrations enable RLS on application tables. Browser Data API access is intentionally denied; all business operations pass through the Next.js server's role checks.

`npm run verify:backend` checks DB/schema and Auth without printing credentials. `npm test`, `npm run lint`, and `npm run build` verify the code.

Render free instances sleep when idle. Vercel's `vercel.json` cron does **not** run on Render. Subscription generation can be run manually from Settings; configure an authenticated external scheduler if automatic daily generation is needed. WhatsApp intake still requires the Meta credentials and webhook configuration in `whatsapp-setup.md`.
