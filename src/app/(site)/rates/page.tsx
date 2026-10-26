import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Coins, Fuel, Gem } from "lucide-react";
import { Aurora } from "@/components/sections";
import { RATE_PAGES, getRateSummaries, type RatePageId } from "@/lib/rates";
import { getUsdRates } from "@/lib/fx";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today's Rates in Pakistan — Dollar, Gold, Petrol",
  description: "Today's dollar rate, gold price per tola and petrol price in Pakistan in one place, updated daily, with links to free calculators.",
  alternates: { canonical: "/rates" },
};

const ICON: Record<RatePageId, typeof Coins> = { dollar: Coins, gold: Gem, petrol: Fuel };
const money = (n: number) => `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

export default async function RatesHub() {
  const [gold, petrol, fx] = await Promise.all([getRateSummaries("gold", 1), getRateSummaries("petrol", 1), getUsdRates().catch(() => null)]);
  const headline: Record<RatePageId, string | null> = {
    dollar: fx?.data.rates.PKR ? `${money(fx.data.rates.PKR)} per USD` : null,
    gold: gold[0] ? `${money(gold[0].value)} ${gold[0].unit}` : null,
    petrol: petrol[0] ? `${money(petrol[0].value)} ${petrol[0].unit}` : null,
  };

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
      <Aurora />
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Today&apos;s rates in Pakistan</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-lg">Dollar, gold and petrol — updated daily, with history and free calculators.</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
        {(Object.entries(RATE_PAGES) as [RatePageId, (typeof RATE_PAGES)[RatePageId]][]).map(([id, p]) => {
          const Icon = ICON[id];
          return (
            <Link key={id} href={`/rates/${p.slug}`} className="group rounded-2xl surface p-6 transition-all hover:-translate-y-1 hover:border-brand-400/40">
              <Icon className="h-7 w-7 text-brand-400" />
              <h2 className="mt-3 text-lg font-extrabold">{p.h1.replace(" in Pakistan today", "")}</h2>
              <p className="mt-1 text-2xl font-black">{headline[id] ?? "Updating…"}</p>
              <span className="mt-3 flex items-center gap-1 text-sm font-bold text-brand-400">
                Details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
