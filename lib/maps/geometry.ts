import { z } from "zod";
import { UpstreamError, ValidationError } from "@/lib/errors";
const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const responseSchema = z.object({ code: z.literal("Ok"), routes: z.array(z.object({ geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2) }) })).min(1) });
/** Road preview in the saved stop order; never changes the optimized route or ETAs. */
export async function getRoadGeometry(points: Array<{lat: number; lng: number}>) {
  const parsed = z.array(point).min(2).max(100).safeParse(points);
  if (!parsed.success) throw new ValidationError("This route has invalid coordinates or too many stops for a road preview.");
  const base = (process.env.OSRM_BASE_URL || "https://router.project-osrm.org").replace(/\/$/, "");
  const coordinates = parsed.data.map(p => `${p.lng},${p.lat}`).join(";");
  try {
    const response = await fetch(`${base}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, { signal: AbortSignal.timeout(12000), next: { revalidate: 300 } });
    const data = responseSchema.safeParse(await response.json());
    if (!response.ok || !data.success) throw new Error("Invalid road response");
    return data.data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  } catch { throw new UpstreamError("Road preview is unavailable. Delivery pins and external navigation still work."); }
}
