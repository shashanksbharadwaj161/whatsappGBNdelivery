import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import { generateDailyOrders } from "@/lib/services/subscriptionGeneration";
import { todayBusinessDateString } from "@/lib/tz";

/**
 * Vercel Cron target — authenticated by CRON_SECRET (a bearer token,
 * self-chosen), not a user session, since Vercel Cron has no browser
 * login. Configure `Authorization: Bearer $CRON_SECRET` as the cron
 * job's header in vercel.json / the Vercel dashboard.
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expected || provided !== expected) {
    throw new AppError(401, "AUTH_ERROR", "Invalid or missing cron secret");
  }

  const result = await generateDailyOrders(todayBusinessDateString());
  return NextResponse.json(result);
});
