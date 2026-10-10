export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://sharmanscab.vercel.app"
).replace(/\/$/, "");

export const BUSINESS = {
  name: "Sharman's Cab Company",
  phone: "+919840061594",
  phoneDisplay: "+91 98400 61594",
  whatsapp: "919840061594",
  gstin: "33AAOCA3846K1ZE",
  founded: "2007",
};

export const TEL_HREF = `tel:${BUSINESS.phone}`;

export function whatsappHref(text: string) {
  return `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
}

export const WHATSAPP_DEFAULT_TEXT =
  "Hi Sharman's Cab, I'd like a quote for a cab/bus. Pickup: , Drop: , Date: ";

export const CITIES = [
  "Chennai",
  "Coimbatore",
  "Madurai",
  "Trichy",
  "Tirunelveli",
  "Salem",
];

// Replace "__" with real rates when confirmed.
export const FLEET = [
  { name: "Sedan", seats: "4 passengers", rate: "__", note: "Dzire / Etios class" },
  { name: "Innova Crysta", seats: "6–7 passengers", rate: "__", note: "Family & outstation" },
  { name: "Tempo Traveller", seats: "12 passengers", rate: "__", note: "Group tours, pilgrimages" },
  { name: "Mini Bus", seats: "20–26 passengers", rate: "__", note: "Weddings, staff transport" },
  { name: "40-seater Bus", seats: "40 passengers", rate: "__", note: "Events, college & corporate trips" },
];

export const VEHICLE_OPTIONS = FLEET.map((v) => v.name);
