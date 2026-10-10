import type { Metadata } from "next";
import { BUSINESS } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy notice — ${BUSINESS.name}`,
  alternates: { canonical: "/privacy" },
};

// Plain-language notice for the quote form (India's DPDP Act, 2023).
// Have it reviewed by the client's adviser before go-live; retention period is a proposal.
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-slate-700">
      <a href="/" className="text-sm font-semibold text-navy-600 underline underline-offset-2">
        ← Back to {BUSINESS.name}
      </a>
      <h1 className="mt-6 text-3xl font-bold text-navy-900">Privacy notice</h1>
      <p className="mt-2 text-sm text-slate-500">
        {BUSINESS.legalName} (&ldquo;{BUSINESS.name}&rdquo;, GSTIN {BUSINESS.gstin})
      </p>

      <h2 className="mt-8 text-xl font-bold text-navy-900">What we collect</h2>
      <p className="mt-2">
        When you ask for a quote we collect your name, mobile number and trip details (pickup, drop, date, time,
        vehicle, passengers). We also record which advert or website brought you to us, such as a Google or Facebook
        click reference.
      </p>

      <h2 className="mt-8 text-xl font-bold text-navy-900">Why we use it</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>To call or message you with a fare and arrange your trip.</li>
        <li>To issue invoices and keep booking records required by law.</li>
        <li>To understand which of our adverts lead to bookings, so we spend less on the ones that don&apos;t.</li>
      </ul>
      <p className="mt-2">We do not sell your data or use it for unrelated marketing.</p>

      <h2 className="mt-8 text-xl font-bold text-navy-900">Who we share it with</h2>
      <p className="mt-2">
        Our booking staff and drivers (only what they need for your trip), and service providers who run our systems:
        our website host and database, Zoho (CRM and invoicing), and Google and Meta (only the advert click reference
        and the fact that a booking happened).
      </p>

      <h2 className="mt-8 text-xl font-bold text-navy-900">How long we keep it</h2>
      <p className="mt-2">
        Quote requests that do not become bookings are deleted after 24 months. Booking and invoice records are kept as
        long as tax law requires.
      </p>

      <h2 className="mt-8 text-xl font-bold text-navy-900">Your choices</h2>
      <p className="mt-2">
        You can ask us to see, correct or delete your details, or withdraw consent, by writing to{" "}
        <a className="font-semibold text-navy-900 underline" href={`mailto:${BUSINESS.email}`}>
          {BUSINESS.email}
        </a>{" "}
        or calling {BUSINESS.phoneDisplay}. We reply within 7 working days.
      </p>
    </main>
  );
}
