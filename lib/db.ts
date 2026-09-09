import { getDatabaseUrl } from "@/lib/database-url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Runtime connection: the *pooled* Supabase URL (PgBouncer, port 6543).
 * Migrations use the direct URL instead — see prisma.config.ts. Prisma 7
 * requires an explicit driver adapter rather than reading the schema's
 * datasource url at runtime.
 */
function createPrismaClient() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("Database connection is not configured");
  }
  const adapter = new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 10000 });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

// Delay connection setup until a request actually uses the database. Build-time
// route discovery must not require runtime secrets or a reachable database.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = globalForPrisma.prisma ??= createPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
