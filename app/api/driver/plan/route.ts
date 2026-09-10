import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { withApiHandler } from "@/lib/api-handler";
import { ValidationError } from "@/lib/errors";
import { todayBusinessDateString } from "@/lib/tz";
import { createOptimizedRoute, getActiveRouteForDate, listRoutableOrdersForDate, reoptimizeRoute } from "@/lib/services/routes";
export const POST = withApiHandler(async (request: NextRequest) => {
  const user = await requireRole(["OWNER", "DRIVER"]);
  const input = z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).safeParse(await request.json());
  if (!input.success) throw new ValidationError("A valid current location is required");
  const date = todayBusinessDateString();
  const active = await getActiveRouteForDate(date);
  // reoptimizeRoute enforces driver ownership and claims an unassigned round.
  if (active) return NextResponse.json(await reoptimizeRoute(active.id, [], user, input.data));
  const orders = await listRoutableOrdersForDate(date);
  if (!orders.length) throw new ValidationError("No confirmed deliveries with resolved addresses are ready for today.");
  if (orders.length > 25) throw new ValidationError("More than 25 orders are ready. Ask the owner to split them into delivery rounds.");
  return NextResponse.json(await createOptimizedRoute({orderIds:orders.map(o=>o.id),startLat:input.data.lat,startLng:input.data.lng,startTime:new Date(),returnToStart:false,actorUserId:user.userId,driverId:user.role==="DRIVER"?user.userId:undefined}));
});
