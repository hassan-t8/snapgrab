"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

/** Friendly fallback when a page throws — the rest of the site keeps working. */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="grid min-h-[60vh] place-items-center px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-red-400">
          <TriangleAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight sm:text-3xl">Something went wrong on our side</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          This page hit an unexpected error. It is usually temporary — try again, or open another tool in the meantime.
        </p>
        {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3 font-bold text-white shadow-xl shadow-brand-500/25 transition-transform hover:scale-105"
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
          <Link href="/tools" className="inline-flex items-center gap-2 rounded-2xl surface px-6 py-3 font-bold hover:border-brand-400/60">
            All tools
          </Link>
        </div>
      </div>
    </section>
  );
}
