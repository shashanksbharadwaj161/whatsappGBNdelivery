import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { reoptimizeRoute } from "@/lib/services/routes";
const schema = z.object({ additionalOrderIds: z.array(z.string().min(1)).max(25).default([]), currentLocation: z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).optional() });
export const POST = withApiHandler(async (request: NextRequest, context: { params: Promise<{ routeId: string }> }) => {
  const user = await requireRole(["OWNER", "DRIVER"]);
  const { routeId } = await context.params;
  const body = schema.safeParse(await request.json());
  if (!body.success) throw new ValidationError("Choose valid orders and a valid starting location");
  if (user.role === "DRIVER" && body.data.additionalOrderIds.length) throw new ValidationError("Only the owner can add orders to an existing route");
  const route = await reoptimizeRoute(routeId, body.data.additionalOrderIds, user.userId, body.data.currentLocation);
  return NextResponse.json(route);
});
