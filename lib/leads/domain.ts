// Pure lead domain rules: no I/O here, so everything is unit-testable.
import { z } from "zod";

/* ---------- Vocabularies ---------- */

export const SERVICES = {
  airport: "Airport transfer",
  one_way: "One-way drop",
  round_trip: "Round trip / outstation",
  local: "Local (hourly)",
  bus_group: "Bus / group hire",
  corporate: "Corporate",
} as const;
export type Service = keyof typeof SERVICES;
export const SERVICE_KEYS = Object.keys(SERVICES) as [Service, ...Service[]];

/** Where the enquiry physically arrived. Website form is only one of five. */
export const CHANNELS = {
  form: "Website form",
  call: "Phone call",
  whatsapp: "WhatsApp",
  arattai: "Arattai",
  walk_in: "Walk-in / referral",
} as const;
export type Channel = keyof typeof CHANNELS;
export const CHANNEL_KEYS = Object.keys(CHANNELS) as [Channel, ...Channel[]];

export const STATUSES = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  booked: "Booked",
  completed: "Completed",
  lost: "Lost",
  cancelled: "Cancelled",
} as const;
export type Status = keyof typeof STATUSES;
export const STATUS_KEYS = Object.keys(STATUSES) as [Status, ...Status[]];
export const OPEN_STATUSES: Status[] = ["new", "contacted", "quoted"];

export const LOST_REASONS = [
  "Price too high",
  "No vehicle available",
  "Booked elsewhere",
  "No response from customer",
  "Trip cancelled by customer",
  "Not a genuine enquiry",
  "Other",
] as const;

/**
 * The pipeline. A lead only moves along these edges; anything else is rejected
 * server-side so the funnel numbers stay honest.
 */
export const TRANSITIONS: Record<Status, Status[]> = {
  new: ["contacted", "quoted", "booked", "lost"],
  contacted: ["quoted", "booked", "lost"],
  quoted: ["quoted", "booked", "lost"], // quoted→quoted = revised quote
  booked: ["completed", "cancelled"],
  completed: [],
  lost: ["new"], // reopen
  cancelled: ["new"], // reopen
};

export function canTransition(from: Status, to: Status) {
  return TRANSITIONS[from].includes(to);
}

export type TransitionInput = {
  to: Status;
  quotedAmount?: number | null;
  bookingValue?: number | null;
  lostReason?: string | null;
};

/** Returns an error message, or null when the move is allowed. */
export function checkTransition(from: Status, input: TransitionInput): string | null {
  if (!canTransition(from, input.to)) {
    return `Can't move a ${STATUSES[from]} lead to ${STATUSES[input.to]}.`;
  }
  if (input.to === "quoted" && !(input.quotedAmount && input.quotedAmount > 0)) {
    return "Enter the quoted fare (₹) to mark this lead Quoted.";
  }
  if (input.to === "booked" && !(input.bookingValue && input.bookingValue > 0)) {
    return "Enter the booking value (₹) to mark this lead Booked.";
  }
  if (input.to === "lost" && !input.lostReason) {
    return "Pick a reason to mark this lead Lost.";
  }
  return null;
}

/* ---------- Phone ---------- */

/**
 * Normalises Indian numbers to E.164 (+91XXXXXXXXXX). Accepts spaces, dashes,
 * 0 / 91 / +91 prefixes. Returns null for anything that isn't a valid
 * 10-digit Indian mobile or landline-with-STD number.
 */
export function normalizeIndianPhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) {
    if (!d.startsWith("+91")) return null;
    d = d.slice(3);
  } else if (d.length === 12 && d.startsWith("91")) {
    d = d.slice(2);
  } else if (d.length === 11 && d.startsWith("0")) {
    d = d.slice(1);
  }
  if (!/^\d{10}$/.test(d)) return null;
  // Mobiles start 6-9; landlines with STD code start 2-5 (e.g. 44 Chennai).
  if (!/^[2-9]/.test(d)) return null;
  return `+91${d}`;
}

export function formatPhone(e164: string) {
  const d = e164.replace(/^\+91/, "");
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

/* ---------- References ---------- */

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

/** Human-friendly booking reference, e.g. SC-261010-K7QX. Safe to read out on a call. */
export function makeRef(now = new Date(), rand: () => number = Math.random) {
  const ist = new Date(now.getTime() + 330 * 60_000); // IST date for the prefix
  const ymd = ist.toISOString().slice(2, 10).replace(/-/g, "");
  let tail = "";
  for (let i = 0; i < 4; i++) tail += REF_ALPHABET[Math.floor(rand() * REF_ALPHABET.length)];
  return `SC-${ymd}-${tail}`;
}

/* ---------- Validation ---------- */

const trimmed = (max: number) => z.string().trim().max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-31, which Date.parse rolls over). */
export function isRealIsoDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const isoDate = z.string().refine(isRealIsoDate, "Use a valid date");

// Attribution is best-effort context: over-long ad tags are trimmed and malformed
// data is dropped. Neither may ever be the reason a customer's enquiry is rejected.
const clipText = (max: number) =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v.slice(0, max) : null));

export const AttributionSchema = z
  .object({
    source: clipText(100),
    medium: clipText(100),
    campaign: clipText(200),
    term: clipText(200),
    content: clipText(200),
    gclid: clipText(300),
    fbclid: clipText(300),
    landingPage: clipText(500),
    referrer: clipText(500),
  })
  .partial()
  .default({})
  .catch({});
export type Attribution = z.infer<typeof AttributionSchema>;

/** Today's date in India, as YYYY-MM-DD. */
export function todayIST(now = new Date()) {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Public website submission. Deliberately short: the desk fills in the rest on the call. */
export const PublicLeadSchema = z
  .object({
    service: z.enum(SERVICE_KEYS),
    pickup: trimmed(120).min(2, "Enter your pickup location"),
    drop: optText(120),
    travelDate: isoDate,
    travelTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    vehicle: optText(60),
    passengers: z.coerce.number().int().min(1).max(200).optional().nullable(),
    name: trimmed(80).min(2, "Enter your name"),
    phone: z.string().max(25).transform((v, ctx) => {
      const n = normalizeIndianPhone(v);
      if (!n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 10-digit mobile number" });
        return z.NEVER;
      }
      return n;
    }),
    message: optText(1000),
    attribution: AttributionSchema,
    idempotencyKey: z.string().min(8).max(64),
    // Honeypot: real users never see or fill this.
    website: z.string().max(0).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.travelDate < todayIST()) {
      ctx.addIssue({ code: "custom", path: ["travelDate"], message: "Date can't be in the past" });
    }
    if (v.service !== "local" && v.service !== "corporate" && !v.drop) {
      ctx.addIssue({ code: "custom", path: ["drop"], message: "Enter your drop location" });
    }
    if (v.service === "bus_group" && !v.passengers) {
      ctx.addIssue({ code: "custom", path: ["passengers"], message: "How many passengers?" });
    }
  });
export type PublicLeadInput = z.input<typeof PublicLeadSchema>;
export type PublicLead = z.output<typeof PublicLeadSchema>;

/** Desk-entered lead (a phone call, WhatsApp chat, walk-in). Fewer requirements. */
export const ManualLeadSchema = z.object({
  channel: z.enum(CHANNEL_KEYS),
  service: z.enum(SERVICE_KEYS),
  name: trimmed(80).min(1, "Enter the customer's name"),
  phone: z.string().max(25).transform((v, ctx) => {
    const n = normalizeIndianPhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number" });
      return z.NEVER;
    }
    return n;
  }),
  pickup: trimmed(120).min(2, "Enter the pickup location"),
  drop: optText(120),
  travelDate: isoDate.optional().nullable().or(z.literal("").transform(() => null)),
  vehicle: optText(60),
  passengers: z.coerce.number().int().min(1).max(200).optional().nullable().or(z.literal("").transform(() => null)),
  message: optText(1000),
  source: optText(100), // "how did you hear about us" as the desk records it
});
export type ManualLead = z.output<typeof ManualLeadSchema>;

/** Readable first error per field, for forms. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/* ---------- Attribution helpers ---------- */

/** Collapses UTM/click IDs into the one "source" bucket the owner reads in reports. */
export function sourceBucket(a: {
  source?: string | null;
  medium?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
  channel?: Channel;
}): string {
  if (a.gclid) return "Google Ads";
  if (a.fbclid) return "Meta Ads";
  const s = (a.source || "").toLowerCase();
  const m = (a.medium || "").toLowerCase();
  if (s) {
    const paid = /cpc|ppc|paid|ads?$/.test(m);
    if (/google/.test(s)) return paid ? "Google Ads" : "Google";
    if (/facebook|instagram|meta|fb|ig/.test(s)) return paid ? "Meta Ads" : "Facebook / Instagram";
    return s.length > 40 ? s.slice(0, 40) : a.source!;
  }
  const r = (a.referrer || "").toLowerCase();
  if (/google\./.test(r)) return "Google (organic)";
  if (/facebook|instagram/.test(r)) return "Facebook / Instagram";
  if (a.channel && a.channel !== "form") return "Not recorded";
  return "Direct";
}

/* ---------- Money ---------- */

export function rupees(n: number | null | undefined) {
  if (n == null) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
