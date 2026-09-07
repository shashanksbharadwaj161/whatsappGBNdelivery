import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { ValidationError, UpstreamError } from "@/lib/errors";
import { resolveGoogleMapsUrl } from "@/lib/maps/resolveShareUrl";

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRole(["OWNER"]);
  const body = await request.json();
  const url = body.url as string | undefined;
  if (!url?.trim()) throw new ValidationError("url is required");

  const result = await resolveGoogleMapsUrl(url.trim());
  if (!result.ok) {
    if (result.code === "INVALID_URL" || result.code === "UNRESOLVED_URL") {
      throw new ValidationError(result.message);
    }
    throw new UpstreamError(result.message);
  }

  return NextResponse.json(result.data);
});
