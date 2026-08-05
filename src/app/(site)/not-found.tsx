import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";

export default function NotFound() {
  return (
    <section className="relative grid min-h-[70vh] place-items-center px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-[7rem] font-black leading-none gradient-text">404</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">This page slipped off the timeline</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          The link is broken or the page has moved. The downloader still works, though — it always does.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3 font-bold text-white shadow-xl shadow-brand-500/25 transition-transform hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 rounded-2xl surface px-6 py-3 font-bold transition-colors hover:border-brand-400/60"
          >
            <Compass className="h-4 w-4" /> Read the blog
          </Link>
        </div>

        <div className="mt-10">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Popular downloaders</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {PLATFORMS.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href={`/download/${p.slug}`}
                className="rounded-full surface px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-brand-400/60 hover:text-brand-400"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
