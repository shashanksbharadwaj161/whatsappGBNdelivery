import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { createOptimizedRoute } from "@/lib/services/routes";

export const POST = withApiHandler(async (request: NextRequest) => {
  const user = await requireRole(["OWNER"]);
  const body = await request.json();

  const orderIds = body.orderIds as string[] | undefined;
  const startLat = Number(body.startLat);
  const startLng = Number(body.startLng);
  const startTime = body.startTime ? new Date(body.startTime) : new Date();

  if (!orderIds?.length) throw new ValidationError("orderIds is required");
  if (Number.isNaN(startLat) || Number.isNaN(startLng)) throw new ValidationError("startLat/startLng are required");

  const route = await createOptimizedRoute({
    orderIds,
    startLat,
    startLng,
    startTime,
    actorUserId: user.userId,
  });

  return NextResponse.json(route);
});
