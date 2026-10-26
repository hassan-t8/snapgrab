"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Star } from "lucide-react";
import { TOOL_MAP } from "@/lib/tools";
import { ToolIcon } from "@/lib/tool-icons";
import { getFavourites, getRecent, onMyToolsChange, recordRecent, toggleFavourite } from "@/lib/my-tools";
import { notify } from "./Toaster";
import { trackEvent } from "@/lib/track-event";

/** Star button on a tool page; also records the visit in "recently used". */
export function FavouriteButton({ slug, name }: { slug: string; name: string }) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    const sync = () => setFav(getFavourites().includes(slug));
    const id = requestAnimationFrame(() => {
      recordRecent(slug);
      sync();
    });
    const off = onMyToolsChange(sync);
    return () => {
      cancelAnimationFrame(id);
      off();
    };
  }, [slug]);

  return (
    <button
      type="button"
      aria-pressed={fav}
      onClick={() => {
        const now = toggleFavourite(slug);
        trackEvent(now ? "favourite" : "unfavourite", slug);
        if (now) notify.success("Added to My tools", `${name} is now on your Tools page and in search.`);
      }}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
        fav ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30" : "surface hover:border-brand-400/60 hover:text-brand-400"
      }`}
    >
      <Star className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />
      {fav ? "Saved" : "Save to My tools"}
    </button>
  );
}

/** Favourites and recently used tools, shown on the tools page when there are any. */
export function MyToolsStrip({ enabled }: { enabled: string[] }) {
  const [fav, setFav] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      setFav(getFavourites().filter((s) => enabled.includes(s)));
      setRecent(getRecent().filter((s) => enabled.includes(s)));
    };
    const id = requestAnimationFrame(sync);
    const off = onMyToolsChange(sync);
    return () => {
      cancelAnimationFrame(id);
      off();
    };
  }, [enabled]);

  if (!fav.length && !recent.length) return null;

  const row = (title: string, Icon: typeof Star, slugs: string[]) =>
    slugs.length > 0 && (
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
          <Icon className="h-3.5 w-3.5" /> {title}
        </p>
        <div className="flex flex-wrap gap-2">
          {slugs.map((s) => {
            const t = TOOL_MAP[s];
            if (!t) return null;
            return (
              <Link key={s} href={`/tools/${s}`} className="flex items-center gap-2 rounded-xl surface px-3 py-2 text-sm font-semibold transition-colors hover:border-brand-400/60 hover:text-brand-400">
                <ToolIcon tool={t} className="h-4 w-4" style={{ color: t.color }} />
                {t.name}
              </Link>
            );
          })}
        </div>
      </div>
    );

  return (
    <section className="px-4 pb-4 sm:px-6 lg:px-8" aria-label="My tools">
      <div className="mx-auto max-w-6xl space-y-4 rounded-2xl border border-brand-400/25 bg-brand-500/5 p-5">
        {row("Your favourites", Star, fav)}
        {row("Recently used", Clock, recent)}
      </div>
    </section>
  );
}
