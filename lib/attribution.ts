// Browser-only. Remembers which ad/campaign brought the visitor so the lead
// (and later the booking) can be credited to it. Last tagged touch wins;
// untagged visits never overwrite a paid click. Google click IDs live 90 days.
import type { Attribution } from "@/lib/leads/domain";

const KEY = "sc_attr";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const PARAMS = {
  utm_source: "source",
  utm_medium: "medium",
  utm_campaign: "campaign",
  utm_term: "term",
  utm_content: "content",
  gclid: "gclid",
  fbclid: "fbclid",
} as const;

type Stored = Attribution & { at: number; tagged: boolean };

function read(): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null") as Stored | null;
    if (!v || Date.now() - v.at > MAX_AGE_MS) return null;
    return v;
  } catch {
    return null;
  }
}

function externalReferrer() {
  try {
    if (!document.referrer) return null;
    const r = new URL(document.referrer);
    return r.host === location.host ? null : document.referrer.slice(0, 500);
  } catch {
    return null;
  }
}

export function captureAttribution() {
  try {
    const url = new URL(location.href);
    const found: Attribution = {};
    for (const [param, field] of Object.entries(PARAMS)) {
      const v = url.searchParams.get(param);
      if (v) found[field as keyof Attribution] = v.slice(0, 300);
    }
    const tagged = Object.keys(found).length > 0;
    const existing = read();
    if (!tagged && existing) return; // keep the earlier (possibly paid) touch
    const next: Stored = {
      ...found,
      landingPage: (url.pathname + url.search).slice(0, 500),
      referrer: externalReferrer(),
      at: Date.now(),
      tagged,
    };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode / storage blocked: attribution is best-effort.
  }
}

export function getAttribution(): Attribution {
  const v = read();
  if (!v) return {};
  const out: Attribution = { ...v };
  delete (out as Partial<Stored>).at;
  delete (out as Partial<Stored>).tagged;
  return out;
}
