import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import { Aurora } from "./sections";
import { Reveal } from "./motion";

/** Shown in place of a tool or downloader that an admin has switched off. */
export default function ServiceUnavailable({
  name,
  note,
  alternatives,
}: {
  name: string;
  note?: string | null;
  alternatives: { href: string; label: string; sub?: string; color?: string }[];
}) {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <Aurora />
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-400">
            <Wrench className="h-6 w-6" />
          </span>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">{name} is temporarily unavailable</h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
            {note?.trim()
              ? note
              : "We have paused this service for maintenance. Everything else on the site is working normally, and it will be back shortly."}
          </p>
        </Reveal>

        {alternatives.length > 0 && (
          <Reveal delay={0.1}>
            <p className="mt-10 text-xs font-bold uppercase tracking-wider text-muted">Try these instead</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {alternatives.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex items-center gap-3 rounded-2xl surface p-4 text-left transition-all hover:-translate-y-1 hover:border-brand-400/40"
                >
                  <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: a.color ?? "var(--color-brand-500)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{a.label}</span>
                    {a.sub && <span className="block truncate text-xs text-muted">{a.sub}</span>}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-400" />
                </Link>
              ))}
            </div>
          </Reveal>
        )}

        <Reveal delay={0.16}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/tools"
              className="rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3 font-bold text-white shadow-xl shadow-brand-500/25 transition-transform hover:scale-105"
            >
              Browse all tools
            </Link>
            <Link href="/contact" className="rounded-2xl surface px-6 py-3 font-bold transition-colors hover:border-brand-400/60">
              Contact support
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
