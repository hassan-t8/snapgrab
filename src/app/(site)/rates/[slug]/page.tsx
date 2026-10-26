import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Clock, Minus } from "lucide-react";
import { Aurora, FAQ, SectionHead } from "@/components/sections";
import AdSlot from "@/components/AdSlot";
import ShareSheet from "@/components/ShareSheet";
import RateChart from "@/components/RateChart";
import { RATE_PAGES, getRateSummaries, ratePageBySlug, type RatePageId, type RateSummary } from "@/lib/rates";
import { getUsdRates } from "@/lib/fx";
import { breadcrumbJsonLd, faqJsonLd, jsonLd, ogImage, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return Object.values(RATE_PAGES).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/rates/[slug]">): Promise<Metadata> {
  const found = ratePageBySlug((await params).slug);
  if (!found) return { title: "Rate not found", robots: { index: false } };
  const [, p] = found;
  const image = ogImage({ title: p.h1, subtitle: "Updated daily · SnapGrab", badge: "Today's rates" });
  return {
    title: p.title,
    description: p.description,
    keywords: p.keywords,
    alternates: { canonical: `/rates/${p.slug}` },
    openGraph: { title: p.title, description: p.description, url: `/rates/${p.slug}`, images: [{ url: image, width: 1200, height: 630 }] },
  };
}

const PK_DATE = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const money = (n: number) => `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

function Change({ now, prev }: { now: number; prev: number | null }) {
  if (prev == null || prev === now) {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-muted">
        <Minus className="h-3.5 w-3.5" /> {prev == null ? "first entry" : "no change"}
      </span>
    );
  }
  const up = now > prev;
  const diff = Math.abs(now - prev);
  return (
    <span className={`flex items-center gap-1 text-xs font-bold ${up ? "text-red-400" : "text-accent-400"}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {up ? "+" : "−"}
      {money(diff).replace("Rs ", "Rs ")} ({((diff / prev) * 100).toFixed(2)}%)
    </span>
  );
}

function RateCard({ r, strong }: { r: RateSummary; strong?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${strong ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white" : "surface"}`}>
      <p className={`text-xs font-bold uppercase tracking-wider ${strong ? "text-white/80" : "text-muted"}`}>
        {r.label} · {r.unit}
      </p>
      <p className="mt-1 text-3xl font-extrabold">{money(r.value)}</p>
      <div className="mt-2">
        <Change now={r.value} prev={r.previous} />
      </div>
    </div>
  );
}

const FAQS: Record<RatePageId, { q: string; a: string }[]> = {
  dollar: [
    { q: "What is the difference between the interbank and open-market dollar rate?", a: "The interbank rate is what banks use between themselves and is the reference for imports and remittances. The open-market rate is what exchange companies charge when you buy or sell cash dollars — usually a few rupees higher." },
    { q: "How often is the dollar rate updated?", a: "The interbank reference rate updates once a day from market data. Open-market buying and selling rates are entered by our team each working day." },
    { q: "How many rupees will I get for my remittance?", a: "Banks and money-transfer apps apply their own rate and fees. Use the currency converter as a guide, then compare what your bank or app offers." },
  ],
  gold: [
    { q: "Why is the gold rate different in my city?", a: "Each city's sarafa association announces its own rate, and jewellers add making charges and sometimes a premium. Prices here are a reference for the main markets." },
    { q: "What is the difference between 24K, 22K and 21K gold?", a: "24K is 99.9% pure, 22K about 91.7% and 21K about 87.5%. Most jewellery in Pakistan is 21K or 22K." },
    { q: "How do I work out the price of my jewellery?", a: "Use the gold rate calculator: enter today's rate, the weight in tola, masha and ratti, the karat and the making charges." },
  ],
  petrol: [
    { q: "How often do petrol prices change in Pakistan?", a: "The government usually reviews petroleum prices every two weeks — around the 1st and 16th of each month — and announces the new prices the night before." },
    { q: "Are these prices the same in every city?", a: "The official petrol and diesel prices are the same nationwide at company-owned pumps; some remote areas and private dealers may differ slightly. LPG prices are set monthly and vary by region." },
    { q: "How much will my trip cost?", a: "Use the fuel cost calculator with today's price, your car's mileage and the distance." },
  ],
};

const RELATED: Record<RatePageId, { href: string; label: string }[]> = {
  dollar: [
    { href: "/tools/currency-converter", label: "Currency converter" },
    { href: "/rates/gold-rate-in-pakistan", label: "Gold rate today" },
    { href: "/rates/petrol-price-in-pakistan", label: "Petrol price today" },
  ],
  gold: [
    { href: "/tools/gold-rate-calculator", label: "Gold rate calculator" },
    { href: "/tools/zakat-calculator", label: "Zakat calculator" },
    { href: "/rates/dollar-rate-in-pakistan", label: "Dollar rate today" },
  ],
  petrol: [
    { href: "/tools/fuel-cost-calculator", label: "Fuel cost calculator" },
    { href: "/rates/dollar-rate-in-pakistan", label: "Dollar rate today" },
    { href: "/rates/gold-rate-in-pakistan", label: "Gold rate today" },
  ],
};

const FX_CODES = ["USD", "SAR", "AED", "GBP", "EUR", "CAD", "AUD", "QAR", "KWD", "OMR", "CNY", "MYR"];

export default async function RatePage({ params }: PageProps<"/rates/[slug]">) {
  const found = ratePageBySlug((await params).slug);
  if (!found) notFound();
  const [id, page] = found;

  const [rates, fx] = await Promise.all([
    getRateSummaries(id, 30),
    id === "dollar" ? getUsdRates().catch(() => null) : Promise.resolve(null),
  ]);
  const pkr = fx?.data.rates.PKR;
  const latest = rates.reduce<string | null>((d, r) => (!d || r.date > d ? r.date : d), null) ?? fx?.data.updatedAt ?? null;
  const hasData = rates.length > 0 || !!pkr;

  return (
    <>
      <section className="relative overflow-hidden px-4 pb-10 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <Aurora />
        <nav aria-label="Breadcrumb" className="mx-auto mb-8 max-w-4xl">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
            <li>
              <Link href="/" className="hover:text-brand-400">
                Home
              </Link>
            </li>
            <ChevronRight className="h-3 w-3" />
            <li>
              <Link href="/rates" className="hover:text-brand-400">
                Rates
              </Link>
            </li>
            <ChevronRight className="h-3 w-3" />
            <li aria-current="page" className="font-semibold text-[var(--fg)]">
              {page.h1.replace(" today", "")}
            </li>
          </ol>
        </nav>

        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{page.h1}</h1>
          {latest && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted">
              <Clock className="h-4 w-4" /> Updated {PK_DATE(latest)}
            </p>
          )}
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">{page.description}</p>
        </div>

        <div className="mx-auto mt-10 max-w-4xl space-y-4">
          {id === "dollar" && pkr && (
            <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-white/80">Interbank reference · 1 USD</p>
              <p className="mt-1 text-4xl font-extrabold">{money(pkr)}</p>
              <p className="mt-1 text-sm text-white/80">Mid-market rate{fx?.stale ? " (last saved — live update pending)" : ""}</p>
            </div>
          )}
          {rates.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {rates.map((r, i) => (
                <RateCard key={r.key} r={r} strong={id !== "dollar" && i === 0} />
              ))}
            </div>
          )}
          {!hasData && (
            <div className="rounded-2xl surface p-8 text-center text-sm text-muted">
              Today&apos;s prices are being updated. Please check back shortly.
            </div>
          )}

          {id === "dollar" && pkr && fx && (
            <div className="overflow-x-auto rounded-2xl surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-4 py-3">Currency</th>
                    <th className="px-4 py-3 text-right">In Pakistani rupees</th>
                  </tr>
                </thead>
                <tbody>
                  {FX_CODES.filter((c) => fx.data.rates[c]).map((c) => (
                    <tr key={c} className="border-t border-[var(--line)]">
                      <td className="px-4 py-2.5 font-semibold">1 {c} to PKR</td>
                      <td className="px-4 py-2.5 text-right font-bold">{money(pkr / fx.data.rates[c])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rates.filter((r) => r.history.length > 1).slice(0, 2).map((r) => (
            <div key={r.key} className="rounded-2xl surface p-4">
              <p className="mb-2 text-sm font-bold">
                {r.label} — last {r.history.length} updates
              </p>
              <RateChart data={r.history} label={r.label} color={id === "gold" ? "#ca8a04" : id === "petrol" ? "#dc2626" : "#7048f0"} />
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <ShareSheet title={page.title} text={`${page.h1} — see today's rates on SnapGrab`} url={`${siteUrl()}/rates/${page.slug}`} />
            {RELATED[id].map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center gap-1.5 rounded-xl surface px-4 py-2.5 text-sm font-bold hover:border-brand-400/60">
                {l.label} <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted">
            Rates are for information only and may differ from what your bank, exchange company, jeweller or pump charges.
            {id === "dollar" && " Interbank reference from ExchangeRate-API."}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <AdSlot className="h-[90px]" />
      </div>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Questions" title="Frequently asked" />
          <div className="mt-10">
            <FAQ items={FAQS[id]} />
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          faqJsonLd(FAQS[id]),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Rates", path: "/rates" },
            { name: page.h1, path: `/rates/${page.slug}` },
          ]),
        )}
      />
    </>
  );
}
