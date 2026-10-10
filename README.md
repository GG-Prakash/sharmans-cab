# Sharman's Cab Company — landing page

Next.js 14 (App Router) + Tailwind. Fully static; deploys to Vercel with zero config.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Environment variables (all optional, set in Vercel → Settings → Environment Variables)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production URL for canonical, JSON-LD, sitemap (e.g. `https://sharmanscab.in`) |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager container ID (`GTM-XXXXXXX`). Loads GTM only when set |
| `NEXT_PUBLIC_QUOTE_ENDPOINT` | URL that receives quote form JSON via POST (e.g. Formspree, Zoho Flow, a webhook) |

## Analytics events

Pushed to `window.dataLayer`:

- `call_click` / `whatsapp_click`: `{ event, cta_location }` (`hero`, `header`, `sticky_bar`, `quote_success`, `footer_cta`, `footer`)
- `form_submit`: `{ event, pickup_city, vehicle_type }`

## Before go-live

- Fill in per-km rates in `lib/site.ts` (`rate: "__"`), and check the seat counts there.
- Add the street address/postcode to the JSON-LD in `app/page.tsx` for better local SEO.
