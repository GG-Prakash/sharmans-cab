import { NextResponse } from "next/server";
import { PublicLeadSchema, fieldErrors, makeRef } from "@/lib/leads/domain";
import { createPublicLead } from "@/lib/leads/repo";
import { notifyNewLead } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 16_000;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(req: Request) {
  // Only accept submissions from our own pages (blocks cross-site form spam).
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = "invalid";
  }
  if (originHost && host && originHost !== host) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  const ip = clientIp(req.headers);
  const rl = rateLimit(`lead:${ip}`, 8, 10 * 60_000);
  if (!rl.ok) {
    return json(
      { ok: false, error: "Too many requests. Please call or WhatsApp us instead." },
      429,
      { "Retry-After": String(rl.retryAfterSec) },
    );
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: "Request too large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  // Honeypot filled → pretend success so bots don't learn, store nothing.
  if (body && typeof body === "object" && "website" in body && (body as { website?: string }).website) {
    return json({ ok: true, ref: makeRef(), outcome: "created" });
  }

  const parsed = PublicLeadSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) }, 422);
  }

  try {
    const { lead, outcome } = await createPublicLead(parsed.data, { userAgent: req.headers.get("user-agent") });
    if (outcome === "created") await notifyNewLead(lead);
    return json({ ok: true, ref: lead.ref, outcome });
  } catch (e) {
    console.error("[api/leads] could not store lead", e);
    // The form falls back to a pre-filled WhatsApp message, so the customer can still reach us.
    return json({ ok: false, error: "We couldn't save your request right now." }, 503);
  }
}
