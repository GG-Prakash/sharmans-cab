import QuoteForm from "@/components/QuoteForm";
import TrackedLink from "@/components/TrackedLink";
import {
  BriefcaseIcon,
  BusIcon,
  CarIcon,
  CheckIcon,
  ChevronIcon,
  PhoneIcon,
  PlaneIcon,
  QuoteIcon,
  RouteIcon,
  UsersIcon,
  WhatsAppIcon,
} from "@/components/Icons";
import {
  BUSINESS,
  CITIES,
  FLEET,
  SITE_URL,
  TEL_HREF,
  WHATSAPP_DEFAULT_TEXT,
  whatsappHref,
} from "@/lib/site";

const WA_HREF = whatsappHref(WHATSAPP_DEFAULT_TEXT);

// Re-render daily so year counts and the copyright never go stale on a static deploy.
export const revalidate = 86400;

const SERVICES = [
  {
    icon: PlaneIcon,
    title: "Airport Transfers",
    text: "On-time pickups and drops at Chennai, Coimbatore, Madurai and Trichy airports. Flight-delay friendly.",
  },
  {
    icon: RouteIcon,
    title: "One-way Drop Taxi",
    text: "Pay only for the distance you travel — no return fare on intercity drops across Tamil Nadu.",
  },
  {
    icon: BriefcaseIcon,
    title: "Corporate Hire",
    text: "Monthly and on-demand cabs for staff and guests, with GST invoices raised through Zoho.",
  },
  {
    icon: BusIcon,
    title: "Bus Rental (12–40 seats)",
    text: "Tempo Travellers, mini buses and 40-seaters for weddings, tours, college and company trips.",
  },
];

const TRUST = [
  { big: "Since 2007", small: `${new Date().getFullYear() - Number(BUSINESS.founded)}+ years on Tamil Nadu roads` },
  { big: "GST registered", small: "Proper tax invoices" },
  { big: "Zoho invoicing", small: "Clean billing for corporates" },
  { big: "24x7", small: "Bookings & support, any hour" },
];

const FAQS = [
  {
    q: "How is the fare calculated?",
    a: "Outstation trips are charged per kilometre for the vehicle you choose, plus driver allowance. Tolls, parking and interstate permits (if any) are extra at actuals. We share the full fare upfront before you confirm.",
  },
  {
    q: "Do you charge return fare on one-way drops?",
    a: "No. Our one-way drop taxi is billed only for the one-way distance, so you don't pay for the cab's empty return trip.",
  },
  {
    q: "How early should I book?",
    a: "Cabs can usually be arranged the same day. For buses, Tempo Travellers and weekend or festival dates, book 2–3 days ahead to be sure of availability.",
  },
  {
    q: "Will I get a GST invoice?",
    a: `Yes. We are GST registered (GSTIN ${BUSINESS.gstin}) and corporate clients receive itemised invoices through Zoho.`,
  },
  {
    q: "Are your drivers experienced?",
    a: "Every trip is chauffeur-driven by experienced drivers who know Tamil Nadu's highways, ghat roads and city routes.",
  },
  {
    q: "Which areas do you cover?",
    a: `We operate across Tamil Nadu, with regular trips from ${CITIES.join(", ")}. Outstation trips to neighbouring states can be arranged on request.`,
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#business`,
      name: BUSINESS.name,
      description:
        "Chauffeur-driven taxi and bus hire across Tamil Nadu: airport transfers, one-way drop taxi, corporate hire and 12–40 seater bus rental.",
      url: `${SITE_URL}/`,
      telephone: BUSINESS.phone,
      foundingDate: BUSINESS.founded,
      taxID: BUSINESS.gstin,
      priceRange: "₹₹",
      legalName: BUSINESS.legalName,
      email: BUSINESS.email,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Karambur Village",
        postalCode: "603204",
        addressRegion: "Tamil Nadu",
        addressCountry: "IN",
      },
      areaServed: CITIES.map((name) => ({ "@type": "City", name })),
      openingHoursSpecification: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "00:00",
        closes: "23:59",
      },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: BUSINESS.phone,
        contactType: "reservations",
        areaServed: "IN",
        availableLanguage: ["English", "Tamil"],
      },
    },
    {
      "@type": "TaxiService",
      "@id": `${SITE_URL}/#taxi`,
      name: `${BUSINESS.name} — Taxi & Bus Hire`,
      provider: { "@id": `${SITE_URL}/#business` },
      areaServed: { "@type": "State", name: "Tamil Nadu" },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Services",
        itemListElement: SERVICES.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.title },
        })),
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold text-navy-900 sm:text-3xl">{title}</h2>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className="bg-navy-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <a href="/" className="flex items-center gap-2 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-400 text-lg font-bold text-navy-950">
              S
            </span>
            <span className="font-bold leading-tight">
              Sharman&apos;s <span className="font-normal text-navy-200">Cab Co.</span>
            </span>
          </a>
          <TrackedLink
            href={TEL_HREF}
            event="call_click"
            location="header"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-amber-400 hover:bg-navy-800"
          >
            <PhoneIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{BUSINESS.phoneDisplay}</span>
            <span className="sm:hidden">Call</span>
          </TrackedLink>
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        {/* Hero + quote form */}
        <section className="bg-navy-900 pb-10 text-white md:pb-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-6 md:grid-cols-[1.1fr,1fr] md:items-start md:pt-12">
            <div className="md:pt-6">
              <p className="inline-flex items-center gap-2 rounded-full bg-navy-800 px-3 py-1 text-xs font-medium text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Available 24x7 · Since 2007
              </p>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
                Chauffeur-driven cabs &amp; buses across{" "}
                <span className="text-amber-400">Tamil Nadu</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg text-navy-100">
                Airport transfers, one-way drops, corporate hire and 12–40 seater buses. Upfront
                fares, experienced drivers, GST invoices.
              </p>

              <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                <TrackedLink
                  href={TEL_HREF}
                  event="call_click"
                  location="hero"
                  className="flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-3.5 text-base font-bold text-navy-950 hover:bg-amber-300"
                >
                  <PhoneIcon /> Call {BUSINESS.phoneDisplay}
                </TrackedLink>
                <div className="grid grid-cols-2 gap-3 sm:contents">
                  <TrackedLink
                    href={WA_HREF}
                    event="whatsapp_click"
                    location="hero"
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#0E7A3E] px-5 py-3.5 text-base font-semibold text-white hover:bg-[#0B6633]"
                  >
                    <WhatsAppIcon /> WhatsApp
                  </TrackedLink>
                  <a
                    href="#quote"
                    className="flex items-center justify-center gap-2 rounded-lg border border-navy-600 px-5 py-3.5 text-base font-semibold text-white hover:bg-navy-800"
                  >
                    <QuoteIcon /> Get Quote
                  </a>
                </div>
              </div>

              <ul className="mt-6 hidden space-y-2 text-navy-100 md:block">
                {["No return fare on one-way drops", "Fare confirmed before you book", "Clean, sanitised vehicles"].map(
                  (t) => (
                    <li key={t} className="flex items-center gap-2">
                      <CheckIcon className="h-5 w-5 text-amber-400" /> {t}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div id="quote" className="scroll-mt-4 rounded-2xl bg-white p-5 text-slate-800 shadow-xl sm:p-6">
              <h2 className="text-xl font-bold text-navy-900">Get a free quote</h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">Our desk calls you back {BUSINESS.callbackPromise}, 24x7.</p>
              <QuoteForm />
            </div>
          </div>
        </section>

        {/* Trust row */}
        <section aria-label="Why choose us" className="border-b border-slate-100 bg-navy-50">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-6 md:grid-cols-4">
            {TRUST.map((t) => (
              <li key={t.big} className="flex items-start gap-2 p-2">
                <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-bold text-navy-900">{t.big}</p>
                  <p className="text-sm text-slate-600">{t.small}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Services */}
        <section id="services" className="mx-auto max-w-6xl px-4 py-14">
          <SectionHeading eyebrow="Services" title="One call for every trip" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-xl border border-slate-200 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy-900 text-amber-400">
                  <Icon />
                </span>
                <h3 className="mt-4 text-lg font-bold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Fleet */}
        <section id="fleet" className="bg-navy-50 py-14">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeading eyebrow="Fleet" title="Pick the right vehicle" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {FLEET.map((v) => {
                const Icon = v.bus ? BusIcon : CarIcon;
                return (
                  <article key={v.name} className="flex flex-col rounded-xl bg-white p-5 shadow-sm">
                    <Icon className="h-7 w-7 text-navy-700" />
                    <h3 className="mt-3 text-lg font-bold text-navy-900">{v.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <UsersIcon /> {v.seats}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{v.note}</p>
                    <p className="mt-4 text-sm text-slate-600">
                      {v.rate != null ? (
                        <>
                          from <span className="text-xl font-bold text-navy-900">₹{v.rate}</span>/km
                        </>
                      ) : (
                        <span className="font-semibold text-navy-900">Rate on request</span>
                      )}
                    </p>
                    <a
                      href="#quote"
                      className="mt-4 rounded-lg border border-navy-200 py-2 text-center text-sm font-semibold text-navy-800 hover:bg-navy-50"
                    >
                      Get quote
                    </a>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-slate-600">
              Rates exclude tolls, parking, permits and driver allowance. Final fare confirmed before booking.
            </p>
          </div>
        </section>

        {/* Cities */}
        <section aria-labelledby="cities-h" className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="cities-h" className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
            Pickups from across Tamil Nadu
          </h2>
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {CITIES.map((c) => (
              <li
                key={c}
                className="rounded-full border border-navy-200 px-4 py-2 text-sm font-semibold text-navy-800"
              >
                {c}
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-navy-50 py-14">
          <div className="mx-auto max-w-3xl px-4">
            <SectionHeading eyebrow="FAQ" title="Questions before you book" />
            <div className="divide-y divide-slate-200 rounded-xl bg-white shadow-sm">
              {FAQS.map((f) => (
                <details key={f.q} className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy-900">
                    {f.q}
                    <ChevronIcon className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-navy-900 py-12 text-center text-white">
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to travel?</h2>
            <p className="mt-2 text-navy-100">Talk to a real person, any time of day.</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <TrackedLink
                href={TEL_HREF}
                event="call_click"
                location="footer_cta"
                className="flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 py-3.5 font-bold text-navy-950 hover:bg-amber-300"
              >
                <PhoneIcon /> Call now
              </TrackedLink>
              <TrackedLink
                href={WA_HREF}
                event="whatsapp_click"
                location="footer_cta"
                className="flex items-center justify-center gap-2 rounded-lg bg-[#0E7A3E] px-6 py-3.5 font-semibold text-white hover:bg-[#0B6633]"
              >
                <WhatsAppIcon /> WhatsApp us
              </TrackedLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-navy-950 pb-28 pt-8 text-sm text-navy-200 md:pb-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 md:flex-row md:items-center md:justify-between">
          <p>
            <span className="font-semibold text-white">{BUSINESS.name}</span> · Est. {BUSINESS.founded}
          </p>
          <p>
            GSTIN: <span className="font-mono text-white">{BUSINESS.gstin}</span>
          </p>
          <p>
            <a href="/privacy" className="hover:underline">
              Privacy
            </a>
          </p>
          <p>
            <TrackedLink href={TEL_HREF} event="call_click" location="footer" className="text-amber-400 hover:underline">
              {BUSINESS.phoneDisplay}
            </TrackedLink>
          </p>
        </div>
        <p className="mx-auto mt-4 max-w-6xl px-4 text-xs text-navy-200/70">
          © {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.
        </p>
      </footer>

      {/* Sticky mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 gap-2 border-t border-navy-800 bg-navy-900/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <TrackedLink
          href={TEL_HREF}
          event="call_click"
          location="sticky_bar"
          className="flex items-center justify-center gap-2 rounded-lg bg-amber-400 py-3 font-bold text-navy-950"
        >
          <PhoneIcon /> Call
        </TrackedLink>
        <TrackedLink
          href={WA_HREF}
          event="whatsapp_click"
          location="sticky_bar"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0E7A3E] py-3 font-semibold text-white"
        >
          <WhatsAppIcon /> WhatsApp
        </TrackedLink>
      </div>
    </>
  );
}
