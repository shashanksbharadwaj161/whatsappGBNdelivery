/** Supports either a connection URL or separate, securely hosted PG settings. */
export function getDatabaseUrl(direct = false): string | undefined {
  if (direct && process.env.DIRECT_URL) return process.env.DIRECT_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { PGHOST, PGUSER, PGPASSWORD } = process.env;
  if (!PGHOST || !PGUSER || !PGPASSWORD) return undefined;
  const url = new URL(`postgresql://${PGHOST}:${process.env.PGPORT || "5432"}/${process.env.PGDATABASE || "postgres"}`);
  url.username = PGUSER;
  url.password = PGPASSWORD;
  url.searchParams.set("sslmode", "require");
  return url.toString();
}
