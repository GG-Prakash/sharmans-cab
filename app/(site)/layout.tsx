import Script from "next/script";
import ClickTracker from "@/components/ClickTracker";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

// Public pages only: analytics and attribution capture never run inside the booking desk.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {GTM_ID && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      )}
      {children}
      <ClickTracker />
    </>
  );
}
