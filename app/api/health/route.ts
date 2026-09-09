import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1 FROM "RouteStop" LIMIT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error as { code?: string; name?: string; cause?: { code?: string } };
    console.error("Database health check failed", { name: failure.name, code: failure.code, causeCode: failure.cause?.code });
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
