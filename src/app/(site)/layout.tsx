import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageTracker from "@/components/PageTracker";
import ClickTracker from "@/components/ClickTracker";
import ToolSearch from "@/components/ToolSearch";
import AnnouncementBar from "@/components/AnnouncementBar";
import Script from "next/script";
import { connection } from "next/server";
import { getEnabledSummary } from "@/lib/services";
import { getIntegrations } from "@/lib/integrations";
import { AdsProvider } from "@/components/AdsConfig";

/** Search Console verification code comes from Admin → Integrations. */
export async function generateMetadata(): Promise<Metadata> {
  const code = (await getIntegrations(["GOOGLE_SITE_VERIFICATION"])).GOOGLE_SITE_VERIFICATION;
  return code ? { verification: { google: code } } : {};
}

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  // render per request: service toggles and ad settings change from the admin panel without a rebuild
  await connection();
  const [services, ads] = await Promise.all([
    getEnabledSummary(),
    getIntegrations(["NEXT_PUBLIC_ADSENSE_CLIENT", "ADSENSE_SLOT"]),
  ]);
  const pub = ads.NEXT_PUBLIC_ADSENSE_CLIENT;
  const adClient = pub && /^ca-pub-\d{10,20}$/.test(pub) ? pub : undefined;

  return (
    <AdsProvider value={{ client: adClient, slot: ads.ADSENSE_SLOT }}>
      {adClient && (
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <Navbar services={services} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <PageTracker />
      <ClickTracker />
      {/* outside the sticky header: its backdrop-filter would trap a fixed overlay */}
      <ToolSearch services={services} />
    </AdsProvider>
  );
}
