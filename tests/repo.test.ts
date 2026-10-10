import { beforeAll, describe, expect, it } from "vitest";
import { getDb, useTestDb } from "@/lib/db";
import { PublicLeadSchema, type PublicLeadInput } from "@/lib/leads/domain";
import {
  addNote,
  createManualLead,
  createPublicLead,
  getLead,
  getMetrics,
  listLeads,
  transitionLead,
  updateLead,
  WorkflowError,
} from "@/lib/leads/repo";

const day = (n: number) => new Date(Date.now() + 86_400_000 * n).toISOString().slice(0, 10);
const lead = (over: Partial<PublicLeadInput> = {}) =>
  PublicLeadSchema.parse({
    service: "airport",
    pickup: "Chennai Airport",
    drop: "T. Nagar",
    travelDate: day(3),
    name: "Priya",
    phone: "9876543210",
    idempotencyKey: crypto.randomUUID(),
    attribution: { source: "google", medium: "cpc", gclid: "CjwKCAjw" },
    ...over,
  });

beforeAll(async () => {
  await useTestDb();
});

describe("lead capture", () => {
  it("stores a website lead with attribution and a readable ref", async () => {
    const { lead: l, outcome } = await createPublicLead(lead(), { userAgent: "vitest" });
    expect(outcome).toBe("created");
    expect(l.ref).toMatch(/^SC-/);
    expect(l.status).toBe("new");
    expect(l.gclid).toBe("CjwKCAjw");
    expect(l.sourceBucket).toBe("Google Ads");
    expect(l.travelDate).toBe(day(3));
  });

  it("is idempotent for retries with the same key", async () => {
    const input = lead({ phone: "9000000001" });
    const a = await createPublicLead(input);
    const b = await createPublicLead(input);
    expect(b.outcome).toBe("retry");
    expect(b.lead.id).toBe(a.lead.id);
  });

  it("merges a resubmission of the same trip instead of creating a second lead", async () => {
    const a = await createPublicLead(lead({ phone: "9000000002" }));
    const b = await createPublicLead(lead({ phone: "9000000002", vehicle: "Innova Crysta" }));
    expect(b.outcome).toBe("duplicate");
    expect(b.lead.id).toBe(a.lead.id);
    const detail = await getLead(a.lead.id);
    expect(detail!.events.map((e) => e.type)).toContain("resubmitted");
  });

  it("logs desk leads as already contacted", async () => {
    const l = await createManualLead(
      {
        channel: "call",
        service: "bus_group",
        name: "Kumar",
        phone: "+919111111111",
        pickup: "Coimbatore",
        drop: "Ooty",
        travelDate: day(10),
        vehicle: "40-seater Bus",
        passengers: 38,
        message: null,
        source: "Existing customer",
      },
      "Anitha",
    );
    expect(l.status).toBe("contacted");
    expect(l.firstContactedAt).not.toBeNull();
    expect(l.assignedTo).toBe("Anitha");
  });
});

describe("pipeline", () => {
  it("walks new → quoted → booked → completed with timestamps and an audit trail", async () => {
    const { lead: l } = await createPublicLead(lead({ phone: "9000000003" }));
    await expect(transitionLead(l.id, { to: "booked" }, "Desk")).rejects.toBeInstanceOf(WorkflowError);
    const q = await transitionLead(l.id, { to: "quoted", quotedAmount: 1450 }, "Desk");
    expect(q.firstContactedAt).not.toBeNull();
    expect(q.quotedAmount).toBe(1450);
    const b = await transitionLead(l.id, { to: "booked", bookingValue: 1400 }, "Desk");
    expect(b.bookingValue).toBe(1400);
    const c = await transitionLead(l.id, { to: "completed" }, "Desk");
    expect(c.closedAt).not.toBeNull();
    await expect(transitionLead(l.id, { to: "lost", lostReason: "Other" }, "Desk")).rejects.toThrow(/Can't/);
    const d = await getLead(l.id);
    expect(d!.events.filter((e) => e.type === "status")).toHaveLength(3);
  });

  it("edits, notes and follow-ups are logged", async () => {
    const { lead: l } = await createPublicLead(lead({ phone: "9000000004" }));
    await updateLead(l.id, { assignedTo: "Ravi", travelTime: "05:30", passengers: 3 }, "Owner");
    await updateLead(l.id, { assignedTo: "Ravi" }, "Owner"); // no-op, no event
    await addNote(l.id, "Flight AI-540, lands 05:10", "Ravi");
    const d = await getLead(l.id);
    expect(d!.lead.assignedTo).toBe("Ravi");
    expect(d!.lead.passengers).toBe(3);
    expect(d!.events.filter((e) => e.type === "edit")).toHaveLength(1);
    expect(d!.events[0].type).toBe("note");
  });

  it("lists open leads with new ones first and supports search by phone digits", async () => {
    const { leads } = await listLeads({ view: "open" });
    expect(leads[0].status).toBe("new");
    const found = await listLeads({ view: "all", q: "000004" });
    expect(found.leads).toHaveLength(1);
  });
});

describe("metrics", () => {
  it("reports bookings, value and source", async () => {
    const m = await getMetrics(30);
    expect(m.leads).toBeGreaterThanOrEqual(5);
    expect(m.booked).toBe(1);
    expect(m.bookingValue).toBe(1400);
    const g = m.bySource.find((s) => s.source === "Google Ads")!;
    expect(g.booked).toBe(1);
    expect(m.medianResponseMins).not.toBeNull();
  });

  it("doesn't count a reopened lead as an unanswered new enquiry", async () => {
    const db = await getDb();
    const before = (await getMetrics(30)).overdueNew;
    const { lead: waiting } = await createPublicLead(lead({ phone: "9000000005" }));
    const { lead: reopened } = await createPublicLead(lead({ phone: "9000000006" }));
    await transitionLead(reopened.id, { to: "lost", lostReason: "Other" }, "Desk");
    await transitionLead(reopened.id, { to: "new" }, "Desk");
    await db.query(`UPDATE leads SET created_at = now() - interval '1 hour' WHERE id = ANY($1::uuid[])`, [
      [waiting.id, reopened.id],
    ]);
    expect((await getMetrics(30)).overdueNew).toBe(before + 1);
  });
});
