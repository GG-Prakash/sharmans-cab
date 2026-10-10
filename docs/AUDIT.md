# Sharman's Cab: application audit & roadmap

_Audit date: 10 Oct 2026 · Codebase: commit `88e73c0` ("Initial commit: Sharman's Cab Company landing page")_

## 1. Verdict

The prototype looked finished but **could not do the one job the client hired it for**: turn ad clicks into bookings he can measure.

- The quote form showed "Almost done!" and stored nothing. It never asked for a phone number.
- It reported a conversion to Google/Meta that may not have existed.
- It discarded the ad click ID, so a booking could never be traced back to the campaign that paid for it.

This pass fixes those bugs and adds the missing operational core:

- a database of every enquiry
- a booking-desk console the team uses daily
- source tracking from ad click → lead → booked ₹ → cost per booking

What's done is verified by:

- 27 unit/database tests, passing on both embedded PGlite and a real Postgres 17 server
- 25 end-to-end browser checks
- type-check, lint and production build all clean

## 2. Bugs found (all fixed)

| # | Severity | Problem | Evidence | Fix |
|---|---|---|---|---|
| 1 | **Critical** | Leads were lost. With no `NEXT_PUBLIC_QUOTE_ENDPOINT` (the default), the form sent nothing. With one set, the HTTP result was ignored. A visitor who didn't tap WhatsApp afterwards vanished. | Browser test: submit → success screen, **0 network requests**. | Server API `POST /api/leads` stores the lead in Postgres **before** success is shown. On failure, the customer gets a pre-filled WhatsApp/Call fallback. |
| 2 | **Critical** | No contact details were collected (no name, no phone). Even a stored lead couldn't be called back. | Form fields: pickup, drop, date, vehicle only. | Name + mobile required, Indian numbers normalised to `+91…`. Trip type, time and passengers added. |
| 3 | **Critical** | Fake conversions. `form_submit` fired before (and regardless of) saving, so Google/Meta bidding would optimise toward phantom leads. | `dataLayer` had `form_submit` with nothing stored. | Fires only after the server confirms a **new** lead, and carries `lead_ref`. Retries and duplicates don't count. |
| 4 | **High** | Ad attribution thrown away: `gclid`, `fbclid` and UTM were never read. "Cost per booking", the client's headline ask, was impossible. | Landing with `?gclid=…` left no trace. | Captured on landing (`lib/attribution.ts`, 90-day memory, paid click never overwritten by later organic visits). Stored on the lead, shown to the desk, exported for Google offline conversions. |
| 5 | **High** | Placeholder prices were public: every fleet card read **"from ₹__/km"**. | Screenshot of the fleet section. | `rate: null` renders "Rate on request". Real rates are a one-line change in `lib/site.ts`. |
| 6 | **High** | The canonical URL defaulted to `sharmanscab.vercel.app`, and every preview was indexable. A POC on vercel.app could be indexed and compete with the live sharmanscab.com. | `<link rel=canonical href="https://sharmanscab.vercel.app">`, robots `allow: /`. | Canonical defaults to `https://sharmanscab.com`. The site is **noindex unless `NEXT_PUBLIC_INDEXABLE=true`** (production only). `/admin` and `/api` are disallowed. |
| 7 | Medium | No spam or abuse protection on the form. | — | Honeypot, per-IP rate limit, same-origin check, 16 KB body cap, server-side validation (zod). |
| 8 | Medium | Double taps and network retries would create duplicate leads (once storage exists). | — | Idempotency key per form. The same trip from the same phone within 24 h merges into the open lead as a timeline event. |
| 9 | Medium | Personal data collected with no privacy notice (India's DPDP Act 2023). | — | `/privacy` page + consent line under the form. **Needs the client's review.** |
| 10 | Medium | GTM loaded on every route, so staff using a future admin would pollute analytics. | `app/layout.tsx` | GTM and attribution moved to the public route group `app/(site)` only. |
| 11 | Low | Fleet sizes didn't match the client's own listings (site says 12/14/25/40-seater + 10-seater Traveller; prototype said 12 and 20–26). | sharmanscab.com bus-rental post | Tempo Traveller 10–14, Mini Bus 25. |
| 12 | Low | "Years in business" and © year froze at build time on a static deploy. | `new Date()` in a static page | Page revalidates daily. |
| 13 | Low | No security headers; header logo linked to `#`. | — | nosniff, frame, referrer, permissions and HSTS headers; logo links to `/`. |
| 14 | Low | JSON-LD had no locality, postcode, legal name or email. | — | Added from the client's registered details. |

## 3. What the platform is now

```
Ad click (gclid/utm) ─▶ Landing page ─▶ Quote form ──POST /api/leads──▶ Postgres (leads + lead_events)
                                │                                            │
                     Call / WhatsApp buttons                    webhook (Zoho Flow → CRM) · email alert
                     (dataLayer events)                                      │
                                                         Booking desk /admin ◀┘
                       Call/WhatsApp ─▶ Quote ₹ ─▶ Booked ₹ ─▶ Completed   (or Lost + reason)
                                                         │
                       Reports: leads · bookings · value by source · cost per booking
                       Exports: all leads CSV · Google Ads offline-conversion CSV
```

### Data model

- **`leads`**: one row per enquiry from any channel (`form`, `call`, `whatsapp`, `arattai`, `walk_in`). It holds the trip, the customer, attribution (UTM, gclid, fbclid, landing page, referrer), workflow fields (status, assignee, quoted ₹, booked ₹, lost reason, follow-up) and lifecycle timestamps (`first_contacted_at`, `quoted_at`, `booked_at`, `closed_at`).
- **`lead_events`**: an append-only audit trail of who did what and when: created, contact, status, edit (with before/after), note, notification sent/failed, resubmitted.
- Migrations are versioned and append-only (`lib/db/migrations.ts`), run under an advisory lock.

### Core rules (single source of truth: `lib/leads/domain.ts`)

- **Pipeline:** `new → contacted → quoted → booked → completed`. Any open lead can become `lost`, and lost or cancelled leads can be reopened. Other jumps are rejected on the server.
- **Money is required where it matters:** Quoted needs a fare, Booked needs a booking value, Lost needs a reason. Without these, the reports would be fiction.
- **First-response time** is stamped automatically the first time staff press Call/WhatsApp or move the lead on.
- **Desk-logged leads** (calls, WhatsApp, walk-ins) start as Contacted and record "how did they hear about us". Phone is most of this business, so leaving it out would make every report wrong.

### Reliability

- The lead is stored **before** any notification is attempted. A notification failure is logged on the lead and never loses it.
- If the database is down, the API returns 503 and the customer still gets a one-tap WhatsApp message with all details.
- On Vercel without `DATABASE_URL`, the app refuses to start the embedded DB (no persistent disk) instead of silently losing leads.
- `/api/health` is ready for an uptime monitor.
- The desk is protected by middleware **and** a check in every server action. Sessions are HMAC-signed, expire after 12 h and are httpOnly. Login is rate-limited and uses constant-time compare.
- CSV exports defuse spreadsheet formula injection.

## 4. Go-live checklist (P0, before any ad spend)

| Step | Why | How |
|---|---|---|
| Provision Postgres | Leads must persist | Neon (Mumbai) → copy the pooled URL into `DATABASE_URL` |
| Set desk secrets | Protect customer data | `ADMIN_PASSWORD` (shared, 12+ chars), `SESSION_SECRET` (32+ random chars) |
| Turn on alerts | A lead nobody sees is lost | `LEAD_NOTIFY_EMAIL` + `RESEND_API_KEY`; and/or `LEAD_WEBHOOK_URL` → Zoho Flow |
| Fill tariffs | "Rate on request" converts worse than a number | `FLEET[].rate` in `lib/site.ts` |
| Confirm claims | Ads + false claims = refunds and bad reviews | See § 6 |
| GTM conversions | Ads need a signal | GTM: Google Ads + Meta conversion tags on `form_submit` (lead), `call_click`, `whatsapp_click` |
| "Booked trip" conversion | Optimise for revenue, not form fills | Google Ads → create an *Import from clicks* conversion named exactly `Booked trip`; upload the export weekly |
| Desk discipline | Reports are only as true as the data | Rule: every call and chat goes into "Log a call", every lead gets closed as Booked or Lost |
| Index only production | Avoid duplicate content | `NEXT_PUBLIC_INDEXABLE=true` on production only |

## 5. Prioritised roadmap

Priority is set by **₹ impact on cost per booking ÷ effort**, with "data the reports depend on" first.

### P1: weeks 2–4 (finish the MVP the client asked for)

1. **Service × city landing pages** (airport, drop taxi, tempo traveller, bus rental × 6 cities)
   - *Why:* ad quality score and organic ranking both need a page that matches the search. One generic page pays more per click.
   - *Build:* add `lib/catalog.ts` (cities, services, local copy, FAQs) and `app/(site)/[service]/[city]/page.tsx` with `generateStaticParams`. Each page pre-selects the form's trip type and includes per-page JSON-LD, a sitemap entry, and 301s from the old WordPress URLs in `next.config.mjs` `redirects()`.
2. **Tracked phone numbers → automatic call leads**
   - *Why:* calls are the biggest channel and today they're logged by hand.
   - *Build:* a virtual number per source (Exotel / MyOperator / Knowlarity). Their webhook goes to `POST /api/calls`, which creates or links a `call` lead by phone with `source` = the number's campaign. Missed calls go into "Needs action".
3. **Per-person staff accounts + roles**
   - *Why:* a shared password can't be revoked per person. The owner should see reports; the desk may not need exports.
   - *Build:* a `staff` table (name, phone, role, password hash, active) behind the same session cookie, with an `owner` / `desk` role check in actions and on `/admin/reports`.
4. **WhatsApp/Arattai alert to the desk phone**
   - *Why:* email is slow on a phone; the 15-minute promise needs a push.
   - *Build:* point `LEAD_WEBHOOK_URL` at Zoho Flow and send a WhatsApp Business API template. Swap to Arattai Business once Zoho publishes its API.
5. **Zoho decision: system of record**
   - *Recommendation:* keep this app as the system of record for leads (it has the workflow and attribution) and push **booked** leads to Zoho Books/CRM via the webhook, adding a `lead.booked` event.
   - *Build:* emit webhooks on status change, not just creation.
6. **Retention job**
   - *Why:* the privacy notice promises deletion of unconverted leads after 24 months.
   - *Build:* a Vercel cron hits `/api/cron/retention` (secret header) and deletes `lost`/`new` leads older than 24 months.

### P2: months 2–3 (V2: book online, fewer calls per booking)

7. **Fare engine + instant estimate**
   - *Build:* a `tariffs` table (vehicle class, ₹/km, min km/day, driver batta, night window) editable in `/admin/tariffs`, plus a distance from the Google Routes API and the formula from the R&D brief.
   - The form shows "Estimated ₹X". The desk still confirms the price and the estimate is stored on the lead.
8. **Quote sent from the desk**
   - *Build:* one tap generates a WhatsApp message (and later a PDF) with the fare breakdown and the ref, and logs `quoted`.
9. **Fleet calendar**
   - *Why:* buses and Travellers double-booked on wedding dates is the costliest operational error.
   - *Build:* `vehicles` and `assignments` tables, an availability check when marking Booked, and a day view.
10. **UPI advance**
    - *Build:* a Razorpay payment link on Booked; its webhook marks the advance paid. This cuts no-shows on bus and wedding bookings.
11. **Automatic follow-ups**
    - *Build:* when a lead is quoted with no booking after 24 h, set `follow_up_at` and surface it in "Needs action". Optionally send a WhatsApp nudge to the customer.

### P3: months 4–9 (V3: run the operation)

12. **Dispatch board + driver PWA:** trip sheet, OTP start, opening/closing km, tolls. The final bill is computed from actuals.
13. **Corporate accounts:** employee bookings, approver, monthly consolidated GST invoice pushed to Zoho Books.
14. **Owner P&L by service and city:** revenue (bookings) minus driver, fuel and ad cost per period.

## 6. Content to confirm with the client

These claims appear on the site and must be true before ads run:

- "Our desk calls you back **within 15 minutes, 24x7**" (`BUSINESS.callbackPromise`)
- "Clean, sanitised vehicles" and "Flight-delay friendly"
- "Experienced drivers". The old copy said "our own drivers", but the client also takes attached vehicles, so it was softened.
- Airports served: Chennai, Coimbatore, Madurai, Trichy
- Corporate invoicing "through Zoho" (true per the client's site; confirm it applies to retail customers too)

## 7. Known limits of this pass

- The rate limiter is per server instance. That's fine for one region; use Upstash Redis if abuse appears.
- Ad spend for cost per booking is typed in on the Reports page. A Google/Meta Ads API pull is a P2 nicety.
- The desk uses one shared password (see P1-3).
- Tested on Chromium desktop and mobile viewports. Real-device checks on low-end Android are still recommended before launch.
