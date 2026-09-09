import { db } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "OWNER" | "DRIVER";

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * The one place every API route / server action asks "who is this and are
 * they allowed here". Middleware redirects browser navigation for UX, but
 * it is not the security boundary — this check runs independently on the
 * server for every request that touches data, per the app's auth design.
 */
export async function requireRole(allowed: UserRole[]) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError(401, "Not authenticated");
  }

  const role = user.app_metadata?.role as UserRole | undefined;
  if (!role || !allowed.includes(role)) {
    throw new AuthError(403, "Forbidden for this role");
  }

  // Only trusted app_metadata grants roles. Mirror an authorized identity so
  // order/route foreign keys work without a separate manual Profile insert.
  await db.profile.upsert({
    where: { id: user.id },
    create: { id: user.id, fullName: user.user_metadata?.full_name || user.email || role, role },
    update: { role },
  });
  return { userId: user.id, role, email: user.email ?? "" };
}

export async function getOptionalUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = user.app_metadata?.role as UserRole | undefined;
  return { userId: user.id, role, email: user.email ?? "" };
}
