import type { Metadata, Viewport } from "next";
import { BUSINESS, INDEXABLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const title = "Sharman's Cab Company — Chauffeur-driven Cabs & Buses in Tamil Nadu";
const description =
  "Airport transfers, one-way drop taxi, corporate hire and 12–40 seater bus rental across Chennai, Coimbatore, Madurai, Trichy, Tirunelveli and Salem. Since 2007. Call +91 98400 61594.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title,
    description,
    siteName: BUSINESS.name,
    locale: "en_IN",
  },
  formatDetection: { telephone: true },
  robots: INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0B1A30",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="bg-white font-sans text-slate-800 antialiased">
        {children}
      </body>
    </html>
  );
}
