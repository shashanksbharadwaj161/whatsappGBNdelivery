import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js conventionally uses .env.local; plain dotenv defaults to .env.
// Load both (local wins) so `prisma migrate`/`prisma studio` see the same
// values the Next.js app does. Silently no-ops on platforms (Vercel) that
// inject env vars directly instead of shipping .env files.
loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: true, quiet: true });

// CLI-only config (migrate, studio, db push). The Prisma Client at runtime
// gets its connection from lib/db.ts via a driver adapter instead — see
// that file for why (pooled vs. direct Supabase connection strings).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrate needs the *direct* (non-pooled) connection.
    url: env("DIRECT_URL"),
  },
});
