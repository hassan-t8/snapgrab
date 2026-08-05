import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  total,
  perPage,
  makeHref,
}: {
  page: number;
  total: number;
  perPage: number;
  makeHref: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const window = [page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages);
  const show = [...new Set([1, ...window, pages])].sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-4">
      <p className="text-xs text-muted">
        Page {page} of {pages} · {total.toLocaleString()} rows
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={makeHref(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft className="h-4 w-4" />
        </PageLink>
        {show.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && show[i - 1] !== p - 1 && <span className="px-1 text-xs text-muted">…</span>}
            <Link
              href={makeHref(p)}
              className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-bold transition-colors ${
                p === page ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white" : "surface text-muted hover:text-[var(--fg)]"
              }`}
            >
              {p}
            </Link>
          </span>
        ))}
        <PageLink href={makeHref(Math.min(pages, page + 1))} disabled={page === pages}>
          <ChevronRight className="h-4 w-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return <span className="grid h-8 w-8 place-items-center rounded-lg surface opacity-40">{children}</span>;
  }
  return (
    <Link href={href} className="grid h-8 w-8 place-items-center rounded-lg surface transition-colors hover:text-brand-400">
      {children}
    </Link>
  );
}
