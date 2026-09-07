import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { startRoute } from "@/lib/services/routeStops";

export const POST = withApiHandler(async (_request: NextRequest, context: { params: Promise<{ routeId: string }> }) => {
  const user = await requireRole(["OWNER", "DRIVER"]);
  const { routeId } = await context.params;
  const route = await startRoute(routeId, user.userId);
  return NextResponse.json(route);
});
