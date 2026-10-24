import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageTracker from "@/components/PageTracker";
import ClickTracker from "@/components/ClickTracker";
import ToolSearch from "@/components/ToolSearch";
import AnnouncementBar from "@/components/AnnouncementBar";
import { getEnabledSummary } from "@/lib/services";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const services = await getEnabledSummary();

  return (
    <>
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
    </>
  );
}
