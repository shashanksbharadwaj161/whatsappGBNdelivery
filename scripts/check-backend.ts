import { getDatabaseUrl } from "../lib/database-url";
import { config } from "dotenv";
import { Client } from "pg";
config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

// Report only readiness, never URLs, tokens, connection errors or credentials.
async function main() {
  let failed = false;
  const report = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
    if (!ok) failed = true;
  };
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) report("Database", false, "Set DATABASE_URL in .env.local or your hosting environment.");
  else {
    const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
    try {
      await client.connect();
      await client.query('SELECT 1 FROM "Profile" LIMIT 1');
      await client.query('SELECT 1 FROM "RouteStop" LIMIT 1');
      await client.query('SELECT 1 FROM "Order" LIMIT 1');
      report("Database", true, "Connected; core application tables are accessible.");
      const roles = await client.query('SELECT role, COUNT(*)::int AS count FROM "Profile" GROUP BY role');
      for (const role of ["OWNER", "DRIVER"]) report(`${role} profile`, roles.rows.some(row => row.role === role && row.count > 0), "An application profile must match the Supabase user ID.");
    } catch { report("Database", false, "Connection or schema check failed. Check DATABASE_URL, network access and migrations."); }
    finally { await client.end().catch(() => {}); }
  }
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const authKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!authUrl || !authKey) report("Authentication", false, "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  else {
    try {
      const res = await fetch(`${authUrl.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: authKey }, signal: AbortSignal.timeout(10000) });
      report("Authentication", res.ok, res.ok ? "Supabase Auth responds to the configured public key. User login still needs a browser check." : "Supabase rejected the configuration.");
    } catch { report("Authentication", false, "Cannot reach Supabase Auth. Check configuration and network access."); }
  }
  console.log(`INFO Maps: ${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? "Google browser key present" : "OpenStreetMap enabled without a key"}.`);
  console.log(`INFO WhatsApp: ${process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.META_APP_SECRET ? "Required credentials present; webhook delivery must still be verified" : "Credentials incomplete"}.`);
  process.exitCode = failed ? 1 : 0;
}
void main();
