import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { ValidationError, UpstreamError } from "@/lib/errors";
import { geocodeAddress } from "@/lib/maps/geocode";

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRole(["OWNER"]);
  const body = await request.json();
  const address = body.address as string | undefined;
  if (!address?.trim()) throw new ValidationError("address is required");

  const result = await geocodeAddress(address.trim());
  if (!result.ok) throw new UpstreamError(result.message);

  return NextResponse.json(result.data);
});
