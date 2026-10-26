import Link from "next/link";
import { Download, Mail, Shield } from "lucide-react";
import { BrandFacebook, BrandInstagram, BrandLinkedIn, BrandTikTok, BrandWhatsApp, BrandX, BrandYouTube } from "./BrandIcons";
import { getSiteSettings } from "@/lib/site-settings";
import { getEnabledPlatforms, getEnabledTools } from "@/lib/services";
import Newsletter from "./Newsletter";

// the tools people search for most, shown first in the footer
const POPULAR_TOOLS = [
  "currency-converter",
  "image-compressor",
  "passport-photo-maker",
  "merge-pdf",
  "salary-tax-calculator-pakistan",
  "cv-maker",
  "prayer-times",
  "qr-code-generator",
];

export default async function Footer() {
  const year = new Date().getFullYear();
  const [TOOLS, PLATFORMS, settings] = await Promise.all([getEnabledTools(), getEnabledPlatforms(), getSiteSettings()]);
  const so = settings.socials;
  const socialLinks = [
    { icon: BrandFacebook, href: so.social_facebook, label: "Facebook" },
    { icon: BrandInstagram, href: so.social_instagram, label: "Instagram" },
    { icon: BrandX, href: so.social_x, label: "X" },
    { icon: BrandYouTube, href: so.social_youtube, label: "YouTube" },
    { icon: BrandTikTok, href: so.social_tiktok, label: "TikTok" },
    { icon: BrandWhatsApp, href: so.social_whatsapp, label: "WhatsApp" },
    { icon: BrandLinkedIn, href: so.social_linkedin, label: "LinkedIn" },
  ].filter((l): l is typeof l & { href: string } => !!l.href);
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-[var(--line)]">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500">
                <Download className="h-[18px] w-[18px] text-white" />
              </span>
              <span className="text-lg font-extrabold tracking-tight">
                Snap<span className="gradient-text">Grab</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Free online tools for images, PDFs, documents, money and daily life — plus a fast media downloader. No
              signup, no software, and most tools run right in your browser.
            </p>
            {socialLinks.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {socialLinks.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer me"
                    aria-label={`SnapGrab on ${label}`}
                    className="grid h-9 w-9 place-items-center rounded-xl surface transition-all hover:-translate-y-0.5 hover:border-brand-400/60 hover:text-brand-400"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <FooterCol
            title="Downloaders"
            links={PLATFORMS.slice(0, 7).map((p) => ({ href: `/download/${p.slug}`, label: p.name }))}
          />

          <FooterCol
            title="Free tools"
            links={[...POPULAR_TOOLS.map((s) => TOOLS.find((t) => t.slug === s)).filter((t) => t !== undefined), ...TOOLS]
              .filter((t, i, all) => all.indexOf(t) === i)
              .slice(0, 8)
              .map((t) => ({ href: `/tools/${t.slug}`, label: t.name }))}
          />

          <FooterCol
            title="Company"
            links={[
              { href: "/about", label: "About us" },
              { href: "/tools", label: "All tools" },
              { href: "/rates", label: "Today's rates" },
              { href: "/contact", label: "Contact" },
              { href: "/blog", label: "Blog" },
              { href: "/faq", label: "FAQ" },
              { href: "/privacy", label: "Privacy policy" },
              { href: "/terms", label: "Terms of service" },
              { href: "/dmca", label: "DMCA" },
            ]}
          />

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">Stay in the loop</h3>
            <p className="mt-3 text-sm text-muted">
              New platform support and guides, roughly once a month. No spam.
            </p>
            <Newsletter />
            <div className="mt-5 flex items-center gap-2 text-xs text-muted">
              <Shield className="h-3.5 w-3.5 text-accent-400" />
              We never store the media you download.
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--line)] pt-6 text-xs text-muted sm:flex-row">
          <p>
            © {year} SnapGrab by <span className="font-semibold text-[var(--fg)]">Nikamynumlians</span>. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <a href={`mailto:${settings.contactEmail}`} className="hover:text-brand-400">
              {settings.contactEmail}
            </a>
          </p>
          <p className="text-center sm:text-right">
            Not affiliated with YouTube, Meta, TikTok or X. Download only what you own or have rights to.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand-400"
            >
              <span className="h-px w-0 bg-brand-400 transition-all duration-300 group-hover:w-3" />
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
