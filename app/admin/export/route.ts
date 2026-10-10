import { getStaff } from "@/lib/staff";
import { exportLeads } from "@/lib/leads/repo";
import { CHANNELS, SERVICES, STATUSES } from "@/lib/leads/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Spreadsheet-safe CSV: quotes everything and defuses formula injection (=, +, -, @).
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

/** Google Ads wants "yyyy-MM-dd HH:mm:ss" plus a time-zone header row. */
function istStamp(iso: string) {
  return new Date(Date.parse(iso) + 330 * 60_000).toISOString().replace("T", " ").slice(0, 19);
}

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 3650);
  const type = url.searchParams.get("type") === "google" ? "google" : "leads";
  const leads = await exportLeads(days);
  const today = new Date().toISOString().slice(0, 10);

  let body: string;
  let name: string;
  if (type === "google") {
    const won = leads.filter((l) => l.gclid && l.bookedAt && (l.status === "booked" || l.status === "completed"));
    // Header row and columns per Google Ads "offline conversion import" template.
    body =
      "Parameters:TimeZone=Asia/Calcutta\r\n" +
      csv([
        ["Google Click ID", "Conversion Name", "Conversion Time", "Conversion Value", "Conversion Currency"],
        ...won.map((l) => [l.gclid, "Booked trip", istStamp(l.bookedAt!), l.bookingValue ?? 0, "INR"]),
      ]).replace(/"/g, "");
    name = `google-ads-offline-conversions-${today}.csv`;
  } else {
    body = csv([
      ["Ref", "Created (IST)", "Status", "Channel", "Trip", "Name", "Phone", "Pickup", "Drop", "Travel date", "Time", "Vehicle", "Passengers", "Quoted ₹", "Booked ₹", "Lost reason", "Handled by", "Source", "UTM source", "UTM medium", "Campaign", "Keyword", "gclid", "fbclid", "Landing page"],
      ...leads.map((l) => [
        l.ref, istStamp(l.createdAt), STATUSES[l.status], CHANNELS[l.channel], SERVICES[l.service], l.name, l.phone, l.pickup, l.drop,
        l.travelDate, l.travelTime, l.vehicle, l.passengers, l.quotedAmount, l.bookingValue, l.lostReason, l.assignedTo,
        l.sourceBucket, l.source, l.medium, l.campaign, l.term, l.gclid, l.fbclid, l.landingPage,
      ]),
    ]);
    name = `sharmans-leads-${today}.csv`;
  }
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
