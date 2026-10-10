// Sample leads for the pitch demo. Without them the desk and reports open empty.
// Every row is flagged is_sample: badged "Sample" in the desk, excluded from the
// Google Ads conversion export, and removable in one click before go-live.
// Timestamps are relative to "now", so a reset always gives a fresh-looking month.
import { getDb, type Queryable } from "@/lib/db";
import { makeRef, todayIST, type Channel, type Service, type Status } from "./domain";

type Sample = {
  name: string;
  phone: string;
  channel: Channel;
  service: Service;
  pickup: string;
  drop: string | null;
  travelIn: number; // days from today (negative = trip already done)
  time?: string;
  vehicle: string;
  pax?: number;
  createdHoursAgo: number;
  respondMins?: number; // website leads only; desk-logged leads are contacted at creation
  status: Status;
  quoted?: number;
  booked?: number;
  lost?: string;
  followUpInHours?: number;
  note?: string;
  src?: { source?: string; medium?: string; campaign?: string; term?: string; gclid?: string; fbclid?: string; referrer?: string };
  by: string;
};

const G = (campaign: string, term: string, id: string) => ({ source: "google", medium: "cpc", campaign, term, gclid: `SAMPLE-${id}` });
const M = (campaign: string, id: string) => ({ source: "facebook", medium: "paid", campaign, fbclid: `SAMPLE-${id}` });
const ORGANIC = { referrer: "https://www.google.com/" };

// Phone numbers are placeholders; the desk hides Call/WhatsApp on sample leads so nobody real is dialled.
export const SAMPLES: Sample[] = [
  { name: "Karthik R", phone: "+919000000101", channel: "form", service: "airport", pickup: "Chennai Airport", drop: "Velachery", travelIn: 2, time: "06:30", vehicle: "Sedan", createdHoursAgo: 0.4, status: "new", src: G("Chennai Airport Taxi", "chennai airport taxi", "01"), by: "Ravi" },
  { name: "Meena S", phone: "+919000000102", channel: "form", service: "one_way", pickup: "Chennai", drop: "Pondicherry", travelIn: 5, vehicle: "Innova Crysta", pax: 5, createdHoursAgo: 3, status: "new", src: ORGANIC, by: "Ravi" },
  { name: "Arun Prakash", phone: "+919000000103", channel: "form", service: "one_way", pickup: "Chennai", drop: "Madurai", travelIn: 4, vehicle: "Sedan", createdHoursAgo: 26, respondMins: 9, status: "contacted", followUpInHours: -1, note: "Wants fare for Sedan and Innova. Call back after 6 pm.", src: G("One-way Drop TN", "one way taxi chennai to madurai", "03"), by: "Ravi" },
  { name: "Lakshmi Narayanan", phone: "+919000000104", channel: "form", service: "bus_group", pickup: "Chennai", drop: "Kumbakonam", travelIn: 18, vehicle: "Mini Bus", pax: 24, createdHoursAgo: 50, respondMins: 22, status: "quoted", quoted: 38500, followUpInHours: 20, note: "Wedding party, 2 days. Comparing with one other operator.", src: M("Bus Rental – Weddings", "04"), by: "Suresh" },
  { name: "Vignesh Kumar", phone: "+919000000105", channel: "form", service: "round_trip", pickup: "Coimbatore", drop: "Ooty", travelIn: 9, vehicle: "Innova Crysta", pax: 6, createdHoursAgo: 75, respondMins: 6, status: "quoted", quoted: 9800, src: G("Outstation Coimbatore", "coimbatore to ooty cab", "05"), by: "Suresh" },
  { name: "Priya Venkatesh", phone: "+919000000106", channel: "form", service: "airport", pickup: "Chennai Airport", drop: "Anna Nagar", travelIn: -3, time: "23:40", vehicle: "Sedan", createdHoursAgo: 150, respondMins: 4, status: "completed", quoted: 1450, booked: 1400, src: G("Chennai Airport Taxi", "airport cab chennai", "06"), by: "Ravi" },
  { name: "Sathish Kumar", phone: "+919000000107", channel: "call", service: "bus_group", pickup: "Chennai", drop: "Tirupati", travelIn: 12, vehicle: "40-seater Bus", pax: 38, createdHoursAgo: 98, status: "booked", quoted: 62000, booked: 60000, note: "Company temple trip. Advance to be collected by Friday.", src: { source: "Existing customer" }, by: "Suresh" },
  { name: "Divya Ramesh", phone: "+919000000108", channel: "form", service: "one_way", pickup: "Trichy", drop: "Chennai", travelIn: -8, vehicle: "Innova Crysta", pax: 4, createdHoursAgo: 266, respondMins: 12, status: "completed", quoted: 6200, booked: 6000, src: G("One-way Drop TN", "trichy to chennai taxi", "08"), by: "Ravi" },
  { name: "Rajesh Babu", phone: "+919000000109", channel: "form", service: "round_trip", pickup: "Madurai", drop: "Rameswaram", travelIn: 6, vehicle: "Tempo Traveller", pax: 12, createdHoursAgo: 122, respondMins: 18, status: "booked", quoted: 14500, booked: 14000, src: M("Group Tours TN", "09"), by: "Suresh" },
  { name: "Anitha Krishnan", phone: "+919000000110", channel: "form", service: "local", pickup: "T. Nagar, Chennai", drop: null, travelIn: -12, time: "09:00", vehicle: "Sedan", createdHoursAgo: 340, respondMins: 7, status: "completed", quoted: 2800, booked: 2800, src: ORGANIC, by: "Ravi" },
  { name: "Senthil M", phone: "+919000000111", channel: "form", service: "one_way", pickup: "Chennai", drop: "Coimbatore", travelIn: -5, vehicle: "Sedan", createdHoursAgo: 218, respondMins: 35, status: "lost", quoted: 8900, lost: "Price too high", src: G("One-way Drop TN", "chennai to coimbatore one way", "11"), by: "Suresh" },
  { name: "Gayathri Raman", phone: "+919000000112", channel: "form", service: "airport", pickup: "Madurai Airport", drop: "Kodaikanal", travelIn: -10, vehicle: "Innova Crysta", createdHoursAgo: 390, respondMins: 41, status: "lost", quoted: 4800, lost: "No response from customer", src: M("Airport Transfers", "12"), by: "Suresh" },
  { name: "Mohammed Irfan", phone: "+919000000113", channel: "whatsapp", service: "round_trip", pickup: "Salem", drop: "Yercaud", travelIn: -15, vehicle: "Innova Crysta", createdHoursAgo: 480, status: "lost", quoted: 5500, lost: "Booked elsewhere", src: { source: "Instagram" }, by: "Ravi" },
  { name: "Kavitha Sundar", phone: "+919000000114", channel: "form", service: "corporate", pickup: "OMR, Sholinganallur", drop: null, travelIn: 3, time: "08:30", vehicle: "Innova Crysta", createdHoursAgo: 190, respondMins: 10, status: "booked", quoted: 42000, booked: 42000, note: "Monthly staff cab, 22 working days. GST invoice to the company.", src: G("Corporate Cabs Chennai", "corporate cab service chennai", "14"), by: "Ravi" },
  { name: "Balaji N", phone: "+919000000115", channel: "form", service: "airport", pickup: "Coimbatore Airport", drop: "Tiruppur", travelIn: -18, time: "14:15", vehicle: "Sedan", createdHoursAgo: 530, respondMins: 5, status: "completed", quoted: 1900, booked: 1850, src: G("Airport Transfers", "coimbatore airport taxi", "15"), by: "Suresh" },
];

const MIN = 60_000;

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function insertSample(q: Queryable, s: Sample, now: number) {
  const created = now - s.createdHoursAgo * 60 * MIN;
  const desk = s.channel !== "form";
  const contacted = s.status === "new" ? null : desk ? created : created + (s.respondMins ?? 10) * MIN;
  const quotedAt = s.quoted && contacted ? contacted + 25 * MIN : null;
  // Bookings land a few hours after the quote, but never in the future.
  const bookedAt = s.booked && quotedAt ? Math.min(quotedAt + 5 * 60 * MIN, now - 30 * MIN) : null;
  const travelDate = addDays(todayIST(new Date(now)), s.travelIn);
  const closedAt =
    s.status === "completed"
      ? Date.parse(`${travelDate}T14:30:00Z`)
      : s.status === "lost" && quotedAt
        ? Math.min(quotedAt + 2 * 1440 * MIN, now - 60 * MIN)
        : null;
  const iso = (t: number | null) => (t == null ? null : new Date(t).toISOString());
  const a = s.src ?? {};
  const landing = desk ? null : a.gclid || a.fbclid ? `/?utm_source=${a.source}&utm_medium=${a.medium}` : "/";

  let id: string | undefined;
  for (let attempt = 0; !id && attempt < 5; attempt++) {
    const rows = await q.query<{ id: string }>(
      `INSERT INTO leads (ref, created_at, updated_at, status, channel, service, name, phone, pickup, drop_location,
         travel_date, travel_time, vehicle, passengers, source, medium, campaign, term, gclid, fbclid, landing_page, referrer,
         assigned_to, quoted_amount, booking_value, lost_reason, follow_up_at, first_contacted_at, quoted_at, booked_at,
         closed_at, created_by, is_sample)
       VALUES ($1, $2::timestamptz, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12, $13::int, $14, $15, $16,
         $17, $18, $19, $20, $21, $22, $23::int, $24::int, $25, $26::timestamptz, $27::timestamptz, $28::timestamptz,
         $29::timestamptz, $30::timestamptz, $31, true)
       ON CONFLICT (ref) DO NOTHING RETURNING id`,
      [
        makeRef(new Date(created)), iso(created), s.status, s.channel, s.service, s.name, s.phone, s.pickup, s.drop,
        travelDate, s.time ?? null, s.vehicle, s.pax ?? null, a.source ?? null, a.medium ?? null, a.campaign ?? null,
        a.term ?? null, a.gclid ?? null, a.fbclid ?? null, landing, a.referrer ?? null,
        s.status === "new" ? null : s.by, s.quoted ?? null, s.booked ?? null, s.lost ?? null,
        s.followUpInHours != null ? iso(now + s.followUpInHours * 60 * MIN) : null,
        iso(contacted), iso(quotedAt), iso(bookedAt), iso(closedAt), desk ? s.by : "website",
      ],
    );
    id = rows[0]?.id;
  }
  if (!id) throw new Error("Could not allocate a unique sample lead reference");

  const events: [number, string, string, Record<string, unknown>][] = [[created, "created", desk ? s.by : "website", { channel: s.channel }]];
  let from: Status = desk ? "contacted" : "new";
  if (!desk && contacted) {
    events.push([contacted, "contact", s.by, { via: "call", statusChanged: true }]);
    from = "contacted";
  }
  if (s.note && contacted) events.push([contacted + MIN, "note", s.by, { text: s.note }]);
  if (quotedAt) {
    events.push([quotedAt, "status", s.by, { from, to: "quoted", quotedAmount: s.quoted }]);
    from = "quoted";
  }
  if (bookedAt) {
    events.push([bookedAt, "status", s.by, { from, to: "booked", bookingValue: s.booked }]);
    from = "booked";
  }
  if (closedAt && s.status !== "booked") {
    events.push([closedAt, "status", s.by, { from, to: s.status, ...(s.lost ? { lostReason: s.lost } : {}) }]);
  }
  for (const [at, type, actor, data] of events) {
    await q.query(`INSERT INTO lead_events (lead_id, at, type, actor, data) VALUES ($1, $2::timestamptz, $3, $4, $5::jsonb)`, [
      id,
      new Date(at).toISOString(),
      type,
      actor,
      JSON.stringify(data),
    ]);
  }
}

export async function countSampleLeads(): Promise<number> {
  const db = await getDb();
  const [r] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM leads WHERE is_sample`);
  return Number(r?.n ?? 0);
}

/** Removes every sample lead (their timeline events cascade). Real leads are untouched. */
export async function clearSampleLeads(): Promise<number> {
  const db = await getDb();
  const rows = await db.query(`DELETE FROM leads WHERE is_sample RETURNING id`);
  return rows.length;
}

/** Replaces the sample set with a fresh copy dated relative to now. */
export async function resetSampleLeads(now = Date.now()): Promise<number> {
  const db = await getDb();
  await db.tx(async (q) => {
    await q.query(`DELETE FROM leads WHERE is_sample`);
    for (const s of SAMPLES) await insertSample(q, s, now);
  });
  return SAMPLES.length;
}
