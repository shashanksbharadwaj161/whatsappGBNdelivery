import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { reoptimizeRoute } from "@/lib/services/routes";

export const POST = withApiHandler(async (request: NextRequest, context: { params: Promise<{ routeId: string }> }) => {
  const user = await requireRole(["OWNER"]);
  const { routeId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const additionalOrderIds = (body.additionalOrderIds as string[] | undefined) ?? [];

  const route = await reoptimizeRoute(routeId, additionalOrderIds, user.userId);
  return NextResponse.json(route);
});
