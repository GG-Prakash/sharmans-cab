import type { Metadata, Viewport } from "next";
import Script from "next/script";
import ClickTracker from "@/components/ClickTracker";
import { BUSINESS, SITE_URL } from "@/lib/site";
import "./globals.css";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

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
        {GTM_ID && (
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        )}
        {children}
        <ClickTracker />
      </body>
    </html>
  );
}
