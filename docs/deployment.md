# Deployment guide (Vercel + Supabase)

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
   Pick a region close to Bengaluru if available (e.g. Mumbai/`ap-south-1`).
2. Once created, go to **Project Settings → Database** and copy:
   - The **pooled** connection string (port 6543, "Transaction" mode) → `DATABASE_URL`.
   - The **direct** connection string (port 5432) → `DIRECT_URL`.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this one
     server-only; it's not currently used by the app but is good to have
     on hand for future server-side admin operations)
4. **Authentication → Providers**: confirm **Email** is enabled (it is
   by default). **Authentication → Settings**: for an internal ops tool
   like this, you may want to disable public sign-ups — the two accounts
   below are created directly by you, not through a public sign-up form.

## 2. Create the owner and driver accounts

The app expects exactly two real users: one `OWNER` (the admin
dashboard) and one `DRIVER`. Create them directly in Supabase rather
than through a sign-up form:

1. **Authentication → Users → Add user** (create with email + password,
   twice — once for the owner, once for the driver).
2. For each user, open it and edit **Raw App Meta Data** to add:
   ```json
   { "role": "OWNER" }
   ```
   (or `"role": "DRIVER"` for the driver account). This is what
   `requireRole()` and the route middleware check — it lives in
   `app_metadata`, which end users cannot edit themselves.
3. Mirror both into the app's `Profile` table so they show up correctly
   as `createdBy`/`driver` on orders and routes:
   ```sql
   insert into "Profile" (id, "fullName", role)
   values ('<owner-user-id-from-supabase>', 'Your Name', 'OWNER'),
          ('<driver-user-id-from-supabase>', 'Driver Name', 'DRIVER');
   ```
   (Find each user's id on the Authentication → Users page.)

## 3. Run migrations against the real database

Locally, with `.env.local` pointed at the real Supabase project:

```bash
npm install
npx prisma migrate deploy
```

(`migrate deploy` applies the committed migrations in `prisma/migrations/`
without generating new ones — that's the right command for an existing,
reviewed schema. Use `npx prisma migrate dev` only while you're actively
changing the schema locally.)

Optionally seed sample data for a quick demo (safe to skip in a real
production database):

```bash
npm run db:seed
```

## 4. Deploy to Vercel

1. Push this repo to GitHub (or your git host of choice) if you haven't
   already.
2. In [vercel.com](https://vercel.com), **Add New → Project**, import
   the repo.
3. Add every variable from `.env.example` under **Settings →
   Environment Variables**, for both Production and Preview:
   `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`,
   `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`,
   `META_APP_SECRET`, `CRON_SECRET` (make up a random string for this
   last one — see `docs/whatsapp-setup.md` and
   `docs/google-maps-setup.md` for where the others come from).
4. Deploy.

## 5. Wire up the webhook and cron after the first deploy

- Once you have your `https://<project>.vercel.app` (or custom) domain,
  follow **Section 6** of `docs/whatsapp-setup.md` to point Meta's
  webhook at `https://<domain>/api/webhooks/whatsapp`.
- The daily subscription-order generation cron is already declared in
  `vercel.json` (runs at 22:30 UTC / ~4:00 AM IST) and authenticates
  itself using the `CRON_SECRET` env var — Vercel automatically sends
  `Authorization: Bearer $CRON_SECRET` when invoking it, so there's
  nothing extra to configure beyond setting that env var. You can also
  trigger it manually any time from **Settings → Subscription orders →
  Run now** in the app itself.

## 6. Smoke test in production

1. Sign in at `/login` with the owner account.
2. **Settings** → set the real default delivery start location.
3. Send a WhatsApp message to +91 63621 34868 from your phone → confirm
   it appears in **Inbox**.
4. **Create order** from that conversation, confirm it, then
   **Routes → Optimize route** with it selected — with a real
   `GOOGLE_MAPS_SERVER_API_KEY` this now calls the actual Routes API
   (no "Dev-only routing" banner should appear).
5. Open **Driver View** for that route, start it, and mark the stop
   delivered — confirm the order flips to Delivered and the route to
   Completed.

This exercises the full WhatsApp → Order → Location → Optimized Route →
Delivered loop against the real, deployed stack.
