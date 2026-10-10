import { describe, expect, it } from "vitest";
import {
  PublicLeadSchema,
  checkTransition,
  makeRef,
  normalizeIndianPhone,
  sourceBucket,
  todayIST,
} from "@/lib/leads/domain";

describe("normalizeIndianPhone", () => {
  it.each([
    ["98400 61594", "+919840061594"],
    ["+91 98400-61594", "+919840061594"],
    ["919840061594", "+919840061594"],
    ["09840061594", "+919840061594"],
    ["044 2345 6789", "+914423456789"],
  ])("%s → %s", (raw, out) => expect(normalizeIndianPhone(raw)).toBe(out));

  it.each(["12345", "+1 415 555 0100", "0000000000", "98400615941", "abc"])("rejects %s", (raw) =>
    expect(normalizeIndianPhone(raw)).toBeNull(),
  );
});

describe("pipeline transitions", () => {
  it("allows the happy path", () => {
    expect(checkTransition("new", { to: "contacted" })).toBeNull();
    expect(checkTransition("contacted", { to: "quoted", quotedAmount: 2650 })).toBeNull();
    expect(checkTransition("quoted", { to: "booked", bookingValue: 2650 })).toBeNull();
    expect(checkTransition("booked", { to: "completed" })).toBeNull();
  });
  it("requires money and reasons", () => {
    expect(checkTransition("contacted", { to: "quoted" })).toMatch(/quoted fare/);
    expect(checkTransition("quoted", { to: "booked", bookingValue: 0 })).toMatch(/booking value/);
    expect(checkTransition("new", { to: "lost" })).toMatch(/reason/);
  });
  it("blocks skipping backwards or out of terminal states", () => {
    expect(checkTransition("completed", { to: "new" })).toMatch(/Can't/);
    expect(checkTransition("booked", { to: "quoted", quotedAmount: 1 })).toMatch(/Can't/);
    expect(checkTransition("lost", { to: "new" })).toBeNull();
  });
});

describe("makeRef", () => {
  it("uses the IST date and a readable 4-char tail", () => {
    // 2026-10-10 20:00 UTC is already 11 Oct in India.
    const ref = makeRef(new Date("2026-10-10T20:00:00Z"), () => 0);
    expect(ref).toBe("SC-261011-AAAA");
    expect(makeRef()).toMatch(/^SC-\d{6}-[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe("PublicLeadSchema", () => {
  const tomorrow = new Date(Date.now() + 86_400_000 * 2).toISOString().slice(0, 10);
  const base = {
    service: "one_way",
    pickup: "Chennai",
    drop: "Madurai",
    travelDate: tomorrow,
    name: "Ravi",
    phone: "98400 61594",
    idempotencyKey: "abc12345",
    attribution: { gclid: "G1" },
  };
  it("accepts a valid lead and normalises the phone", () => {
    const r = PublicLeadSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("+919840061594");
  });
  it("rejects past dates, missing drop, honeypot and bad phones", () => {
    expect(PublicLeadSchema.safeParse({ ...base, travelDate: "2020-01-01" }).success).toBe(false);
    expect(PublicLeadSchema.safeParse({ ...base, drop: "" }).success).toBe(false);
    expect(PublicLeadSchema.safeParse({ ...base, website: "spam.com" }).success).toBe(false);
    expect(PublicLeadSchema.safeParse({ ...base, phone: "12" }).success).toBe(false);
  });
  it("requires passengers for bus hire but not a drop for local hire", () => {
    expect(PublicLeadSchema.safeParse({ ...base, service: "bus_group" }).success).toBe(false);
    expect(PublicLeadSchema.safeParse({ ...base, service: "bus_group", passengers: 35 }).success).toBe(true);
    expect(PublicLeadSchema.safeParse({ ...base, service: "local", drop: "" }).success).toBe(true);
  });
  it("accepts today in India", () => {
    expect(PublicLeadSchema.safeParse({ ...base, travelDate: todayIST() }).success).toBe(true);
  });
  it("rejects calendar dates that don't exist", () => {
    expect(PublicLeadSchema.safeParse({ ...base, travelDate: "2099-02-31" }).success).toBe(false);
    expect(PublicLeadSchema.safeParse({ ...base, travelDate: "2099-13-01" }).success).toBe(false);
  });
  it("trims over-long or malformed ad tags instead of rejecting the lead", () => {
    const long = PublicLeadSchema.safeParse({ ...base, attribution: { source: "s".repeat(150), campaign: "c".repeat(250) } });
    expect(long.success).toBe(true);
    if (long.success) {
      expect(long.data.attribution.source).toHaveLength(100);
      expect(long.data.attribution.campaign).toHaveLength(200);
    }
    const junk = PublicLeadSchema.safeParse({ ...base, attribution: { source: 42 } });
    expect(junk.success).toBe(true);
    if (junk.success) expect(junk.data.attribution).toEqual({});
  });
});

describe("sourceBucket", () => {
  it("prefers click IDs, then UTM, then referrer", () => {
    expect(sourceBucket({ gclid: "x", source: "facebook" })).toBe("Google Ads");
    expect(sourceBucket({ fbclid: "x" })).toBe("Meta Ads");
    expect(sourceBucket({ source: "google", medium: "cpc" })).toBe("Google Ads");
    expect(sourceBucket({ source: "google", medium: "organic" })).toBe("Google");
    expect(sourceBucket({ referrer: "https://www.google.com/" })).toBe("Google (organic)");
    expect(sourceBucket({})).toBe("Direct");
    expect(sourceBucket({ channel: "call" })).toBe("Not recorded");
  });
});
