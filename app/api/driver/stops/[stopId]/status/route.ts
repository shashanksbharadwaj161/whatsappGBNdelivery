import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { updateStopStatus } from "@/lib/services/routeStops";

export const POST = withApiHandler(async (request: NextRequest, context: { params: Promise<{ stopId: string }> }) => {
  const user = await requireRole(["OWNER", "DRIVER"]);
  const { stopId } = await context.params;
  const body = await request.json();

  const status = body.status as string | undefined;
  if (status !== "DELIVERED" && status !== "SKIPPED" && status !== "UNAVAILABLE") {
    throw new ValidationError("status must be DELIVERED, SKIPPED, or UNAVAILABLE");
  }

  const stop = await updateStopStatus({
    stopId,
    status,
    failureReason: body.failureReason,
    actor: user,
  });

  return NextResponse.json(stop);
});
