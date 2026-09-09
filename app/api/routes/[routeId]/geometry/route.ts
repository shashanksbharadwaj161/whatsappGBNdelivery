import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/auth/guard";
import { getRouteDetail } from "@/lib/services/routes";
import { getRoadGeometry } from "@/lib/maps/geometry";

export const GET = withApiHandler(async (_request: NextRequest, context: { params: Promise<{ routeId: string }> }) => {
  await requireRole(["OWNER", "DRIVER"]);
  const { routeId } = await context.params;
  const route = await getRouteDetail(routeId);
  const start = { lat: route.startLocationLat, lng: route.startLocationLng };
  const stops = route.revisionNumber > 1 ? route.stops.filter(stop => stop.status === "PENDING" || stop.status === "EN_ROUTE") : route.stops;
  const points = [start, ...stops.map(stop => ({ lat: stop.latitudeSnapshot, lng: stop.longitudeSnapshot })), ...(route.returnToStart ? [start] : [])];
  const path = await getRoadGeometry(points);
  return NextResponse.json({ path, source: "OpenStreetMap road preview" }, { headers: { "Cache-Control": "private, no-store" } });
});
