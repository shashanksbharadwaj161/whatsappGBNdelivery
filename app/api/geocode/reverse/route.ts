import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { ValidationError, UpstreamError } from "@/lib/errors";
import { reverseGeocode } from "@/lib/maps/geocode";

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRole(["OWNER"]);
  const body = await request.json();
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new ValidationError("latitude and longitude are required");
  }

  const result = await reverseGeocode(latitude, longitude);
  if (!result.ok) throw new UpstreamError(result.message);

  return NextResponse.json(result.data);
});
