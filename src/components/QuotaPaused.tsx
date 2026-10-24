import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

/**
 * Shown in place of a tool whose external API allowance is used up. The page around it stays
 * (and stays indexed) — only the working part is swapped out until the plan renews.
 */
export default function QuotaPaused({
  name,
  resetsAt,
  alternatives,
}: {
  name: string;
  resetsAt: Date;
  alternatives: { href: string; label: string; sub?: string; color?: string }[];
}) {
  const when = resetsAt.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return (
    <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 text-center sm:p-10">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-400">
        <Clock className="h-6 w-6" />
      </span>
      <h2 className="mt-5 text-xl font-extrabold sm:text-2xl">The {name.toLowerCase()} is resting until its limit renews</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        So many people used this tool that we have hit our provider&apos;s usage limit. It switches back on by itself on{" "}
        <strong className="text-[var(--fg)]">{when} UTC</strong> — no need to do anything.
      </p>

      {alternatives.length > 0 && (
        <>
          <p className="mt-8 text-xs font-bold uppercase tracking-wider text-muted">Meanwhile, these work right now</p>
          <div className="mt-3 grid gap-3 text-left sm:grid-cols-2">
            {alternatives.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex min-w-0 items-center gap-3 rounded-2xl surface p-4 transition-all hover:-translate-y-1 hover:border-brand-400/40"
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
        </>
      )}
    </div>
  );
}
