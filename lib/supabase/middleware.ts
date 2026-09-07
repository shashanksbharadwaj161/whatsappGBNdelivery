import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const OWNER_ONLY_SEGMENTS = [
  "dashboard",
  "inbox",
  "orders",
  "routes",
  "customers",
  "analytics",
  "settings",
];
const OWNER_OR_DRIVER_SEGMENTS = ["driver"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured (e.g. this sandbox before real credentials
  // are supplied), don't hard-block the whole app — let requests through
  // so the rest of the build is reachable, but every API route/action
  // still independently calls requireRole(), which will reject them.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const segment = request.nextUrl.pathname.split("/")[1] ?? "";
  const role = user?.app_metadata?.role as string | undefined;

  const needsOwner = OWNER_ONLY_SEGMENTS.includes(segment);
  const needsOwnerOrDriver = OWNER_OR_DRIVER_SEGMENTS.includes(segment);

  const blocked =
    (needsOwner && role !== "OWNER") ||
    (needsOwnerOrDriver && role !== "OWNER" && role !== "DRIVER");

  if (blocked) {
    if (!user) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
    // Logged in, just the wrong role for this area — send them home
    // instead of bouncing to /login (which they'd already be past).
    const home = role === "DRIVER" ? "/driver" : "/dashboard";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return response;
}
