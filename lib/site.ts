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
  // The promise shown after a form submission. Only keep it if the desk can honour it 24x7.
  callbackPromise: "within 15 minutes",
};

export const TEL_HREF = `tel:${BUSINESS.phone}`;

export function whatsappHref(text: string) {
  return `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
}

export const WHATSAPP_DEFAULT_TEXT =
  "Hi Sharman's Cab (via website), I'd like a quote. Pickup: , Drop: , Date: ";

export const CITIES = ["Chennai", "Coimbatore", "Madurai", "Trichy", "Tirunelveli", "Salem"];

/**
 * Per-km rates in ₹. `null` shows "Rate on request" instead of a number.
 * Fill these from the client's confirmed tariff before go-live.
 * Seat counts follow the client's own listings (12/14/25/40-seater, 10-seater Traveller).
 */
export const FLEET: { name: string; seats: string; rate: number | null; note: string; bus: boolean }[] = [
  { name: "Sedan", seats: "4 passengers", rate: null, note: "Dzire / Etios class", bus: false },
  { name: "Innova Crysta", seats: "6–7 passengers", rate: null, note: "Family & outstation", bus: false },
  { name: "Tempo Traveller", seats: "10–14 passengers", rate: null, note: "Group tours, pilgrimages", bus: true },
  { name: "Mini Bus", seats: "25 passengers", rate: null, note: "Weddings, staff transport", bus: true },
  { name: "40-seater Bus", seats: "40 passengers", rate: null, note: "Events, college & corporate trips", bus: true },
];

export const VEHICLE_OPTIONS = FLEET.map((v) => v.name);

/** Trip types offered on the public form, in display order. */
export const TRIP_TYPES: { service: Service; label: string; dropLabel: string; needsDrop: boolean }[] = [
  { service: "airport", label: "Airport", dropLabel: "Drop location", needsDrop: true },
  { service: "one_way", label: "One-way drop", dropLabel: "Drop city", needsDrop: true },
  { service: "round_trip", label: "Round trip", dropLabel: "Destination", needsDrop: true },
  { service: "local", label: "Local hourly", dropLabel: "Places to visit (optional)", needsDrop: false },
  { service: "bus_group", label: "Bus / group", dropLabel: "Destination", needsDrop: true },
];
