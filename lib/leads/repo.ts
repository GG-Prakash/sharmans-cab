import { getDb, type Queryable } from "@/lib/db";
import {
  OPEN_STATUSES,
  checkTransition,
  makeRef,
  sourceBucket,
  type Channel,
  type ManualLead,
  type PublicLead,
  type Service,
  type Status,
  type TransitionInput,
} from "./domain";

/* ---------- Types ---------- */

export type Lead = {
  id: string;
  ref: string;
  createdAt: string;
  updatedAt: string;
  status: Status;
  channel: Channel;
  service: Service;
  name: string;
  phone: string;
  pickup: string;
  drop: string | null;
  travelDate: string | null;
  travelTime: string | null;
  vehicle: string | null;
  passengers: number | null;
  message: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  gclid: string | null;
  fbclid: string | null;
  landingPage: string | null;
  referrer: string | null;
  assignedTo: string | null;
  quotedAmount: number | null;
  bookingValue: number | null;
  lostReason: string | null;
  followUpAt: string | null;
  firstContactedAt: string | null;
  quotedAt: string | null;
  bookedAt: string | null;
  closedAt: string | null;
  createdBy: string | null;
  isSample: boolean;
  sourceBucket: string;
};

export type LeadEvent = {
  id: number;
  at: string;
  type: string;
  actor: string;
  data: Record<string, unknown>;
};

/* ---------- Mapping ---------- */

const COLS = `l.*, to_char(l.travel_date, 'YYYY-MM-DD') AS travel_date_text`;

const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const num = (v: unknown) => (v == null ? null : Number(v));

function toLead(r: any): Lead {
  const lead: Omit<Lead, "sourceBucket"> = {
    id: r.id,
    ref: r.ref,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    status: r.status,
    channel: r.channel,
    service: r.service,
    name: r.name,
    phone: r.phone,
    pickup: r.pickup,
    drop: r.drop_location,
    travelDate: r.travel_date_text ?? null,
    travelTime: r.travel_time,
    vehicle: r.vehicle,
    passengers: num(r.passengers),
    message: r.message,
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    term: r.term,
    content: r.content,
    gclid: r.gclid,
    fbclid: r.fbclid,
    landingPage: r.landing_page,
    referrer: r.referrer,
    assignedTo: r.assigned_to,
    quotedAmount: num(r.quoted_amount),
    bookingValue: num(r.booking_value),
    lostReason: r.lost_reason,
    followUpAt: iso(r.follow_up_at),
    firstContactedAt: iso(r.first_contacted_at),
    quotedAt: iso(r.quoted_at),
    bookedAt: iso(r.booked_at),
    closedAt: iso(r.closed_at),
    createdBy: r.created_by,
    isSample: r.is_sample === true,
  };
  return { ...lead, sourceBucket: sourceBucket(lead) };
}

async function logEvent(q: Queryable, leadId: string, type: string, actor: string, data: Record<string, unknown> = {}) {
  await q.query(`INSERT INTO lead_events (lead_id, type, actor, data) VALUES ($1, $2, $3, $4::jsonb)`, [
    leadId,
    type,
    actor,
    JSON.stringify(data),
  ]);
}

export async function recordEvent(leadId: string, type: string, actor: string, data: Record<string, unknown> = {}) {
  const db = await getDb();
  await logEvent(db, leadId, type, actor, data);
}

const CASTS: Record<string, string> = {
  travel_date: "::date",
  passengers: "::int",
  first_contacted_at: "::timestamptz",
};

/** Inserts with a unique ref; retries on the (rare) ref collision. */
async function insertLead(q: Queryable, cols: Record<string, unknown>): Promise<Lead | null> {
  const keys = Object.keys(cols);
  for (let attempt = 0; attempt < 5; attempt++) {
    const values = [makeRef(), ...keys.map((k) => cols[k])];
    const rows = await q.query(
      `INSERT INTO leads (ref, ${keys.join(", ")})
       VALUES ($1, ${keys.map((k, i) => `$${i + 2}${CASTS[k] ?? ""}`).join(", ")})
       ON CONFLICT DO NOTHING
       RETURNING *, to_char(travel_date, 'YYYY-MM-DD') AS travel_date_text`,
      values,
    );
    if (rows[0]) return toLead(rows[0]);
    // Conflict: either idempotency key (caller handles) or ref collision (retry).
    if (cols.idempotency_key) {
      const existing = await q.query(`SELECT ${COLS} FROM leads l WHERE idempotency_key = $1`, [cols.idempotency_key]);
      if (existing[0]) return null;
    }
  }
  throw new Error("Could not allocate a unique lead reference");
}

/* ---------- Create ---------- */

export type CreateResult = { lead: Lead; outcome: "created" | "retry" | "duplicate" };

/**
 * Website submission.
 *  - Same idempotency key (network retry, double tap) → the original lead, nothing new.
 *  - Same phone + service + travel date while the lead is still open, within 24 h →
 *    merged into the existing lead as an event, so the desk doesn't call twice.
 */
export async function createPublicLead(input: PublicLead, meta: { userAgent?: string | null } = {}): Promise<CreateResult> {
  const db = await getDb();
  return db.tx(async (q) => {
    const prior = await q.query(`SELECT ${COLS} FROM leads l WHERE idempotency_key = $1`, [input.idempotencyKey]);
    if (prior[0]) return { lead: toLead(prior[0]), outcome: "retry" as const };

    const dupe = await q.query(
      `SELECT ${COLS} FROM leads l
        WHERE phone = $1 AND service = $2 AND travel_date = $3::date
          AND status = ANY($4::text[]) AND created_at > now() - interval '24 hours'
        ORDER BY created_at DESC LIMIT 1`,
      [input.phone, input.service, input.travelDate, OPEN_STATUSES],
    );
    if (dupe[0]) {
      const lead = toLead(dupe[0]);
      await logEvent(q, lead.id, "resubmitted", "website", {
        pickup: input.pickup,
        drop: input.drop,
        vehicle: input.vehicle,
        message: input.message,
      });
      await q.query(`UPDATE leads SET updated_at = now() WHERE id = $1`, [lead.id]);
      return { lead, outcome: "duplicate" as const };
    }

    const a = input.attribution ?? {};
    const lead = await insertLead(q, {
      channel: "form",
      service: input.service,
      name: input.name,
      phone: input.phone,
      pickup: input.pickup,
      drop_location: input.drop,
      travel_date: input.travelDate,
      travel_time: input.travelTime ?? null,
      vehicle: input.vehicle,
      passengers: input.passengers ?? null,
      message: input.message,
      source: a.source ?? null,
      medium: a.medium ?? null,
      campaign: a.campaign ?? null,
      term: a.term ?? null,
      content: a.content ?? null,
      gclid: a.gclid ?? null,
      fbclid: a.fbclid ?? null,
      landing_page: a.landingPage ?? null,
      referrer: a.referrer ?? null,
      idempotency_key: input.idempotencyKey,
      user_agent: meta.userAgent?.slice(0, 300) ?? null,
      created_by: "website",
    });
    if (!lead) {
      // Lost a race with a concurrent request carrying the same key.
      const again = await q.query(`SELECT ${COLS} FROM leads l WHERE idempotency_key = $1`, [input.idempotencyKey]);
      return { lead: toLead(again[0]), outcome: "retry" as const };
    }
    await logEvent(q, lead.id, "created", "website", { channel: "form" });
    return { lead, outcome: "created" as const };
  });
}

/** Lead logged by the desk from a call, WhatsApp chat or walk-in. Counts as contacted immediately. */
export async function createManualLead(input: ManualLead, actor: string): Promise<Lead> {
  const db = await getDb();
  return db.tx(async (q) => {
    const lead = await insertLead(q, {
      channel: input.channel,
      service: input.service,
      name: input.name,
      phone: input.phone,
      pickup: input.pickup,
      drop_location: input.drop,
      travel_date: input.travelDate ?? null,
      vehicle: input.vehicle,
      passengers: input.passengers ?? null,
      message: input.message,
      source: input.source,
      status: "contacted",
      first_contacted_at: new Date().toISOString(),
      assigned_to: actor,
      created_by: actor,
    });
    if (!lead) throw new Error("Lead insert failed");
    await logEvent(q, lead.id, "created", actor, { channel: input.channel });
    return lead;
  });
}

/* ---------- Read ---------- */

export type LeadFilter = {
  view?: "open" | "all" | "due" | Status;
  q?: string;
  service?: Service | "";
  limit?: number;
  offset?: number;
};

export async function listLeads(f: LeadFilter = {}): Promise<{ leads: Lead[]; total: number }> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const view = f.view || "open";
  if (view === "open") where.push(`status = ANY(${p(OPEN_STATUSES)}::text[])`);
  else if (view === "due")
    // Everything the desk should touch now: every untouched lead, plus follow-ups that have come due.
    where.push(`(status = 'new' OR (status = ANY(${p(OPEN_STATUSES)}::text[]) AND follow_up_at <= now()))`);
  else if (view !== "all") where.push(`status = ${p(view)}`);

  if (f.service) where.push(`service = ${p(f.service)}`);
  if (f.q?.trim()) {
    const term = f.q.trim();
    const digits = term.replace(/\D/g, "");
    const like = p(`%${term}%`);
    const parts = [`name ILIKE ${like}`, `ref ILIKE ${like}`, `pickup ILIKE ${like}`, `drop_location ILIKE ${like}`];
    if (digits.length >= 4) parts.push(`phone LIKE ${p(`%${digits}%`)}`);
    where.push(`(${parts.join(" OR ")})`);
  }

  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  // New leads first (oldest new = most urgent), then by travel date, then newest.
  const order =
    view === "open" || view === "due"
      ? `ORDER BY (status = 'new') DESC, CASE WHEN status = 'new' THEN created_at END ASC, travel_date ASC NULLS LAST, created_at DESC`
      : `ORDER BY created_at DESC`;
  const limit = Math.min(f.limit ?? 50, 500);
  const offset = Math.max(f.offset ?? 0, 0);

  const [rows, count] = await Promise.all([
    db.query(`SELECT ${COLS} FROM leads l ${w} ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM leads l ${w}`, params),
  ]);
  return { leads: rows.map(toLead), total: Number(count[0]?.n ?? 0) };
}

export async function getLead(id: string): Promise<{ lead: Lead; events: LeadEvent[] } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const db = await getDb();
  const rows = await db.query(`SELECT ${COLS} FROM leads l WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const ev = await db.query(`SELECT id, at, type, actor, data FROM lead_events WHERE lead_id = $1 ORDER BY at DESC, id DESC`, [id]);
  return {
    lead: toLead(rows[0]),
    events: ev.map((e: any) => ({
      id: Number(e.id),
      at: iso(e.at)!,
      type: e.type,
      actor: e.actor,
      data: typeof e.data === "string" ? JSON.parse(e.data) : e.data,
    })),
  };
}

/** Other leads from the same phone: repeat customers and earlier enquiries. */
export async function leadsByPhone(phone: string, excludeId: string): Promise<Lead[]> {
  const db = await getDb();
  const rows = await db.query(`SELECT ${COLS} FROM leads l WHERE phone = $1 AND id <> $2 ORDER BY created_at DESC LIMIT 20`, [
    phone,
    excludeId,
  ]);
  return rows.map(toLead);
}

/* ---------- Workflow ---------- */

export class WorkflowError extends Error {}

export async function transitionLead(id: string, input: TransitionInput, actor: string): Promise<Lead> {
  const db = await getDb();
  return db.tx(async (q) => {
    const rows = await q.query(`SELECT ${COLS} FROM leads l WHERE id = $1 FOR UPDATE`, [id]);
    if (!rows[0]) throw new WorkflowError("Lead not found");
    const lead = toLead(rows[0]);
    const err = checkTransition(lead.status, input);
    if (err) throw new WorkflowError(err);

    const set: string[] = [`status = $2`, `updated_at = now()`];
    const params: unknown[] = [id, input.to];
    set[0] = `status = $2::text`;
    const add = (sql: string, v: unknown) => {
      params.push(v);
      set.push(sql.replace("?", `$${params.length}`));
    };

    if (lead.status === "new" && !lead.firstContactedAt) set.push(`first_contacted_at = now()`);
    if (input.to === "quoted") {
      add(`quoted_amount = ?::int`, Math.round(input.quotedAmount!));
      set.push(`quoted_at = now()`);
    }
    if (input.to === "booked") {
      add(`booking_value = ?::int`, Math.round(input.bookingValue!));
      set.push(`booked_at = now()`, `follow_up_at = NULL`);
    }
    if (input.to === "lost") {
      add(`lost_reason = ?`, input.lostReason);
      set.push(`closed_at = now()`, `follow_up_at = NULL`);
    }
    if (input.to === "completed" || input.to === "cancelled") set.push(`closed_at = now()`, `follow_up_at = NULL`);
    if (input.to === "new") set.push(`lost_reason = NULL`, `closed_at = NULL`, `booked_at = NULL`);

    const updated = await q.query(
      `UPDATE leads SET ${set.join(", ")} WHERE id = $1 RETURNING *, to_char(travel_date, 'YYYY-MM-DD') AS travel_date_text`,
      params,
    );
    await logEvent(q, id, "status", actor, {
      from: lead.status,
      to: input.to,
      ...(input.to === "quoted" ? { quotedAmount: input.quotedAmount } : {}),
      ...(input.to === "booked" ? { bookingValue: input.bookingValue } : {}),
      ...(input.to === "lost" ? { lostReason: input.lostReason } : {}),
    });
    return toLead(updated[0]);
  });
}

/** Marks a new lead as contacted the first time staff calls/WhatsApps from the console. */
export async function markContacted(id: string, actor: string, via: "call" | "whatsapp") {
  const db = await getDb();
  await db.tx(async (q) => {
    const rows = await q.query<{ status: string }>(
      `UPDATE leads SET status = 'contacted', first_contacted_at = COALESCE(first_contacted_at, now()), updated_at = now()
        WHERE id = $1 AND status = 'new' RETURNING status`,
      [id],
    );
    await logEvent(q, id, "contact", actor, { via, statusChanged: rows.length > 0 });
  });
}

export async function addNote(id: string, text: string, actor: string) {
  const body = text.trim().slice(0, 2000);
  if (!body) throw new WorkflowError("Note is empty");
  const db = await getDb();
  await db.tx(async (q) => {
    await logEvent(q, id, "note", actor, { text: body });
    await q.query(`UPDATE leads SET updated_at = now() WHERE id = $1`, [id]);
  });
}

const EDITABLE = {
  name: "name",
  pickup: "pickup",
  drop: "drop_location",
  travelDate: "travel_date",
  travelTime: "travel_time",
  vehicle: "vehicle",
  passengers: "passengers",
  assignedTo: "assigned_to",
  followUpAt: "follow_up_at",
} as const;
export type LeadPatch = Partial<Record<keyof typeof EDITABLE, string | number | null>>;

export async function updateLead(id: string, patch: LeadPatch, actor: string): Promise<void> {
  const db = await getDb();
  await db.tx(async (q) => {
    const rows = await q.query(`SELECT ${COLS} FROM leads l WHERE id = $1 FOR UPDATE`, [id]);
    if (!rows[0]) throw new WorkflowError("Lead not found");
    const before = toLead(rows[0]);
    const set: string[] = [];
    const params: unknown[] = [id];
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, col] of Object.entries(EDITABLE) as [keyof typeof EDITABLE, string][]) {
      if (!(k in patch)) continue;
      const to = patch[k] === "" ? null : patch[k];
      const from = before[k as keyof Lead];
      if ((from ?? null) === (to ?? null)) continue;
      if (k === "followUpAt" && from && to && new Date(String(from)).getTime() === new Date(String(to)).getTime()) continue;
      params.push(to);
      const cast = k === "travelDate" ? "::date" : k === "followUpAt" ? "::timestamptz" : k === "passengers" ? "::int" : "";
      set.push(`${col} = $${params.length}${cast}`);
      changes[k] = { from, to };
    }
    if (!set.length) return;
    await q.query(`UPDATE leads SET ${set.join(", ")}, updated_at = now() WHERE id = $1`, params);
    await logEvent(q, id, "edit", actor, { changes });
  });
}

/* ---------- Reporting ---------- */

export type Metrics = {
  days: number;
  leads: number;
  byStatus: Record<Status, number>;
  booked: number;
  bookingValue: number;
  conversionRate: number | null;
  medianResponseMins: number | null;
  respondedWithin15: number | null;
  bySource: { source: string; leads: number; booked: number; value: number }[];
  byService: { service: Service; leads: number; booked: number; value: number }[];
  lostReasons: { reason: string; count: number }[];
  overdueNew: number;
  followUpsDue: number;
};

export async function getMetrics(days = 30): Promise<Metrics> {
  const db = await getDb();
  const rows = (
    await db.query(`SELECT ${COLS} FROM leads l WHERE created_at >= now() - ($1::int * interval '1 day')`, [days])
  ).map(toLead);
  const [due] = await db.query<{ overdue: number; follow: number }>(
    `SELECT
       count(*) FILTER (WHERE status = 'new' AND first_contacted_at IS NULL AND created_at < now() - interval '15 minutes')::int AS overdue,
       count(*) FILTER (WHERE status = ANY($1::text[]) AND follow_up_at <= now())::int AS follow
     FROM leads`,
    [OPEN_STATUSES],
  );

  const byStatus = { new: 0, contacted: 0, quoted: 0, booked: 0, completed: 0, lost: 0, cancelled: 0 } as Record<Status, number>;
  const src = new Map<string, { leads: number; booked: number; value: number }>();
  const svc = new Map<Service, { leads: number; booked: number; value: number }>();
  const lost = new Map<string, number>();
  const responseMins: number[] = [];
  let booked = 0;
  let value = 0;

  for (const l of rows) {
    byStatus[l.status]++;
    const won = l.status === "booked" || l.status === "completed";
    const v = won ? l.bookingValue ?? 0 : 0;
    if (won) {
      booked++;
      value += v;
    }
    for (const [map, key] of [
      [src, l.sourceBucket],
      [svc, l.service],
    ] as const) {
      const m = map as Map<any, { leads: number; booked: number; value: number }>;
      const e = m.get(key) ?? { leads: 0, booked: 0, value: 0 };
      e.leads++;
      if (won) {
        e.booked++;
        e.value += v;
      }
      m.set(key, e);
    }
    if (l.status === "lost" && l.lostReason) lost.set(l.lostReason, (lost.get(l.lostReason) ?? 0) + 1);
    // Response time only means something for leads that arrived unattended (website).
    if (l.channel === "form" && l.firstContactedAt) {
      responseMins.push((Date.parse(l.firstContactedAt) - Date.parse(l.createdAt)) / 60_000);
    }
  }
  responseMins.sort((a, b) => a - b);
  const median = responseMins.length
    ? responseMins.length % 2
      ? responseMins[(responseMins.length - 1) / 2]
      : (responseMins[responseMins.length / 2 - 1] + responseMins[responseMins.length / 2]) / 2
    : null;
  const decided = rows.filter((l) => !OPEN_STATUSES.includes(l.status)).length;

  return {
    days,
    leads: rows.length,
    byStatus,
    booked,
    bookingValue: value,
    conversionRate: decided ? booked / decided : null,
    medianResponseMins: median,
    respondedWithin15: responseMins.length ? responseMins.filter((m) => m <= 15).length / responseMins.length : null,
    bySource: [...src].map(([source, e]) => ({ source, ...e })).sort((a, b) => b.leads - a.leads),
    byService: [...svc].map(([service, e]) => ({ service, ...e })).sort((a, b) => b.leads - a.leads),
    lostReasons: [...lost].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    overdueNew: Number(due?.overdue ?? 0),
    followUpsDue: Number(due?.follow ?? 0),
  };
}

export async function exportLeads(days: number): Promise<Lead[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT ${COLS} FROM leads l WHERE created_at >= now() - ($1::int * interval '1 day') ORDER BY created_at DESC`,
    [days],
  );
  return rows.map(toLead);
}
