// New-lead fan-out. Every channel is optional and failures never block the
// customer: the lead is already safe in the database before this runs, and each
// attempt is written to the lead's timeline so the desk can see what went out.
import { SITE_URL } from "@/lib/site";
import { SERVICES, formatPhone } from "@/lib/leads/domain";
import { recordEvent, type Lead } from "@/lib/leads/repo";

const TIMEOUT_MS = 4000;

async function post(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(t);
  }
}

function summary(l: Lead) {
  const route = l.drop ? `${l.pickup} → ${l.drop}` : l.pickup;
  // Customer text goes into the email subject: collapse newlines so the provider never rejects it.
  return `${SERVICES[l.service]}: ${route}${l.travelDate ? `, ${l.travelDate}` : ""}`.replace(/\s+/g, " ");
}

/** Payload for Zoho Flow / Zapier / Make → Zoho CRM, Sheets, WhatsApp API, etc. */
export function webhookPayload(l: Lead) {
  return {
    event: "lead.created",
    ref: l.ref,
    createdAt: l.createdAt,
    service: l.service,
    serviceLabel: SERVICES[l.service],
    name: l.name,
    phone: l.phone,
    pickup: l.pickup,
    drop: l.drop,
    travelDate: l.travelDate,
    travelTime: l.travelTime,
    vehicle: l.vehicle,
    passengers: l.passengers,
    message: l.message,
    source: l.sourceBucket,
    utm: { source: l.source, medium: l.medium, campaign: l.campaign, term: l.term, content: l.content },
    gclid: l.gclid,
    fbclid: l.fbclid,
    landingPage: l.landingPage,
    adminUrl: `${SITE_URL}/admin/leads/${l.id}`,
  };
}

export async function notifyNewLead(l: Lead) {
  const jobs: { channel: string; run: () => Promise<void> }[] = [];

  const hook = process.env.LEAD_WEBHOOK_URL;
  if (hook) {
    jobs.push({
      channel: "webhook",
      run: () =>
        post(hook, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.LEAD_WEBHOOK_SECRET ? { "X-Webhook-Secret": process.env.LEAD_WEBHOOK_SECRET } : {}),
          },
          body: JSON.stringify(webhookPayload(l)),
        }),
    });
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_EMAIL;
  if (key && to) {
    const lines = [
      `${l.name} · ${formatPhone(l.phone)}`,
      summary(l),
      l.travelTime ? `Time: ${l.travelTime}` : "",
      l.vehicle ? `Vehicle: ${l.vehicle}` : "",
      l.passengers ? `Passengers: ${l.passengers}` : "",
      l.message ? `Message: ${l.message}` : "",
      `Source: ${l.sourceBucket}`,
      "",
      `Open in the booking desk: ${SITE_URL}/admin/leads/${l.id}`,
    ].filter((x) => x !== "");
    jobs.push({
      channel: "email",
      run: () =>
        post("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.LEAD_FROM_EMAIL || "Sharman's Cab Leads <onboarding@resend.dev>",
            to: to.split(",").map((s) => s.trim()),
            subject: `New lead ${l.ref} — ${summary(l)}`,
            text: lines.join("\n"),
          }),
        }),
    });
  }

  await Promise.all(
    jobs.map(async (j) => {
      try {
        await j.run();
        await recordEvent(l.id, "notify_ok", "system", { channel: j.channel });
      } catch (e) {
        console.error(`[notify] ${j.channel} failed for ${l.ref}:`, e);
        await recordEvent(l.id, "notify_failed", "system", { channel: j.channel, error: String(e) }).catch(() => {});
      }
    }),
  );
}
