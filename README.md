# Sharman's Cab Company — website + booking desk

Next.js 14 (App Router) + Tailwind + Postgres. Two parts in one app:

| Part | URL | What it does |
| --- | --- | --- |
| Public site | `/` | Mobile-first landing page; quote form saves every enquiry to the database with its ad source |
| Booking desk | `/admin` | Staff inbox: call/WhatsApp the customer, quote, book, log calls, reports, exports |

See **[docs/AUDIT.md](docs/AUDIT.md)** for the audit, what changed and the prioritised roadmap.

## Run it locally

```bash
npm install
cp .env.example .env.local        # set ADMIN_PASSWORD and SESSION_SECRET
npm run dev                       # http://localhost:3000  ·  desk: http://localhost:3000/admin
```

No database install needed for development: when `DATABASE_URL` is empty, an embedded Postgres (PGlite) is created in `./.data/pglite` and the tables are migrated automatically.

```bash
npm test        # domain + database tests (in-memory PGlite)
npm run lint
npm run build
```

To run the tests against a real, **throwaway** Postgres: `TEST_DATABASE_URL=postgres://… npm test` (it drops and recreates the tables).

## Deploy (Vercel)

1. Create a Postgres database (Neon, Mumbai region, is simplest) and copy its pooled connection string.
2. In Vercel → Settings → Environment Variables, set everything in `.env.example`. `DATABASE_URL`, `ADMIN_PASSWORD` and `SESSION_SECRET` are required.
3. Set `NEXT_PUBLIC_INDEXABLE=true` **only** on the production environment, once the domain points here.
4. Add an uptime monitor on `/api/health` (returns 200 when the database is reachable).

Tables are created on first request; migrations live in `lib/db/migrations.ts` (append-only).

## How a lead flows

1. A visitor arrives from an ad: `utm_*`, `gclid` and `fbclid` are stored in the browser for 90 days (`lib/attribution.ts`).
2. The form posts to `POST /api/leads`. It is validated (`lib/leads/domain.ts`), protected by a honeypot, a rate limit and a same-origin check, and is idempotent (retries never duplicate). The lead is stored before the customer sees "Request received" with a reference like `SC-261010-K7QX`.
3. Notifications go out (webhook for Zoho Flow / Zapier, email via Resend). Every attempt, including failures, is written to the lead's timeline.
4. The desk works the lead: Call / WhatsApp (logs the first-response time) → Quote (₹) → Booked (₹) → Completed, or Lost with a reason. Illegal jumps are rejected server-side.
5. Reports show leads, bookings and value by source; type in ad spend to get **cost per lead and cost per booking**. Export booked Google clicks as an offline-conversion CSV so Google Ads optimises for bookings.

## Analytics events (`window.dataLayer`, public pages only)

- `call_click` / `whatsapp_click`: `{ cta_location }` (`hero`, `header`, `sticky_bar`, `quote_success`, `quote_error`, `footer_cta`, `footer`)
- `form_submit`: `{ lead_ref, service, vehicle_type }`. Fired only when a **new** lead is stored, so use it as the Google Ads / Meta lead conversion.

## Before go-live

- Fill per-km rates in `lib/site.ts` (`rate: null` shows "Rate on request").
- Confirm the content claims listed in `docs/AUDIT.md` § Content to confirm (callback promise, 24x7, drivers, sanitised vehicles).
- Have the privacy notice (`app/(site)/privacy/page.tsx`) reviewed.
