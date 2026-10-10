import type { Service } from "@/lib/leads/domain";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sharmanscab.com").replace(/\/$/, "");

/**
 * Search engines may index the site only when this is explicitly "true".
 * Keeps Vercel previews and the POC from competing with the live site in Google.
 */
export const INDEXABLE = process.env.NEXT_PUBLIC_INDEXABLE === "true";

export const BUSINESS = {
  name: "Sharman's Cab Company",
  legalName: "AgniSharman Logistics Private Limited",
  phone: "+919840061594",
  phoneDisplay: "+91 98400 61594",
  whatsapp: "919840061594",
  email: "MailBox@agniSharman.com",
  gstin: "33AAOCA3846K1ZE",
  founded: "2007",
};

/**
 * Pitch mode: a slim "preview concept" banner on every page and a sample-data
 * toolbar in the desk. On unless NEXT_PUBLIC_PREVIEW is explicitly "false",
 * so a concept deploy can never pass for the client's live site by accident.
 */
export const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW !== "false";
export const PREVIEW_CREDIT = "Gnanaprakash G.";

export const TEL_HREF = `tel:${BUSINESS.phone}`;

export function whatsappHref(text: string) {
  return `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
}

export const WHATSAPP_DEFAULT_TEXT =
  "Hi Sharman's Cab (via website), I'd like a quote. Pickup: , Drop: , Date: ";

export const CITIES = ["Chennai", "Coimbatore", "Madurai", "Trichy", "Tirunelveli", "Salem"];

/**
 * `rate`: per-km ₹. The client's tariff page (sharmanscab.com/sharmans-cab-tariff/)
 * publishes no per-km rates ("available on request"), so these stay null until he confirms them.
 * `allowance`: outstation chauffeur's allowance per calendar day, as published on that page
 * (₹700 Force Traveller, ₹600 all other cars; buses not listed).
 * Seat counts follow the client's own listings (12/14/25/40-seater, 10-seater Traveller).
 */
export const FLEET: {
  name: string;
  seats: string;
  rate: number | null;
  allowance: number | null;
  note: string;
  bus: boolean;
}[] = [
  { name: "Sedan", seats: "4 passengers", rate: null, allowance: 600, note: "Dzire / Etios class", bus: false },
  { name: "Innova Crysta", seats: "6–7 passengers", rate: null, allowance: 600, note: "Family & outstation", bus: false },
  { name: "Tempo Traveller", seats: "10–14 passengers", rate: null, allowance: 700, note: "Force Traveller · group tours", bus: true },
  { name: "Mini Bus", seats: "25 passengers", rate: null, allowance: null, note: "Weddings, staff transport", bus: true },
  { name: "40-seater Bus", seats: "40 passengers", rate: null, allowance: null, note: "Events, college & corporate trips", bus: true },
];

/** Fare terms exactly as published on the client's tariff and "Why Sharmans Cab" pages. */
export const FARE_TERMS = [
  { title: "Local hire", text: "Packages of 5 hrs / 50 km and 10 hrs / 100 km, garage to garage. Half-day use beyond 7 hrs moves to the 10 hr package." },
  { title: "Outstation", text: "Billed per calendar day, minimum 250 km a day, plus the driver allowance shown on each vehicle." },
  { title: "Airport transfers", text: "Flat fare, confirmed with you when you book." },
  { title: "Extras", text: "Tolls, parking and permits at actuals. GST 5% extra." },
];

/** "Driver Service Starting from ₹300" on the client's site: a driver for the customer's own car. */
export const DRIVER_SERVICE_FROM = 300;

export const VEHICLE_OPTIONS = FLEET.map((v) => v.name);

/** Trip types offered on the public form, in display order. */
export const TRIP_TYPES: { service: Service; label: string; dropLabel: string; needsDrop: boolean }[] = [
  { service: "airport", label: "Airport", dropLabel: "Drop location", needsDrop: true },
  { service: "one_way", label: "One-way drop", dropLabel: "Drop city", needsDrop: true },
  { service: "round_trip", label: "Round trip", dropLabel: "Destination", needsDrop: true },
  { service: "local", label: "Local hourly", dropLabel: "Places to visit (optional)", needsDrop: false },
  { service: "bus_group", label: "Bus / group", dropLabel: "Destination", needsDrop: true },
];
