import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// For uptime monitors (UptimeRobot, Better Stack): 200 when the lead store is reachable.
export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    await db.query("SELECT 1");
    return NextResponse.json(
      { ok: true, db: db.driver, ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[health]", e);
    return NextResponse.json({ ok: false, error: "database unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
