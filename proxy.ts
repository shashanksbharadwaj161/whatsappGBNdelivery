import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimization files.
     * API routes are included on purpose — /api/driver/** and
     * /api/routes/** still get a UX-level redirect here, though the real
     * enforcement is requireRole() inside each handler.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
