import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { createOptimizedRoute } from "@/lib/services/routes";
const schema = z.object({ orderIds: z.array(z.string().min(1)).min(1).max(25), startLat: z.number().min(-90).max(90), startLng: z.number().min(-180).max(180), startTime: z.iso.datetime().optional(), returnToStart: z.boolean().default(false) });
export const POST = withApiHandler(async (request: NextRequest) => {
  const user = await requireRole(["OWNER"]);
  const body = schema.safeParse(await request.json());
  if (!body.success) throw new ValidationError("Select orders and provide a valid starting location and time");
  const route = await createOptimizedRoute({ ...body.data, startTime: body.data.startTime ? new Date(body.data.startTime) : new Date(), actorUserId: user.userId });
  return NextResponse.json(route);
});
