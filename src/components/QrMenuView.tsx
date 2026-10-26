"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, Phone, Search, UtensilsCrossed, X } from "lucide-react";
import { BrandWhatsApp } from "@/components/BrandIcons";
import { formatPrice, telHref, themeColor, whatsappHref, type QrMenu } from "@/lib/qr-menu";

/**
 * Mobile menu used by the public /m viewer and by the QR Menu Maker's live preview.
 * Everything is rendered as plain text (React escapes it) — the data comes from a URL anyone can craft.
 */
export default function QrMenuView({ menu, embedded = false }: { menu: QrMenu; embedded?: boolean }) {
  const [query, setQuery] = useState("");
  const accent = themeColor(menu.theme);
  // readable on both the light and the dark site theme
  const accentText = `color-mix(in oklab, ${accent} 60%, var(--fg))`;
  const tel = telHref(menu.phone);
  const wa = whatsappHref(menu.whatsapp || "", menu.name ? `Hi ${menu.name}, I'd like to place an order.` : undefined);
  const idBase = embedded ? "menu-preview-cat" : "menu-cat";
  const Heading = embedded ? "h2" : "h1";

  const q = query.trim().toLowerCase();
  const categories = useMemo(() => {
    const withItems = menu.categories.filter((c) => c.items.length > 0);
    if (!q) return withItems.map((c, i) => ({ ...c, index: i }));
    return withItems
      .map((c, i) => ({
        ...c,
        index: i,
        items: c.name.toLowerCase().includes(q) ? c.items : c.items.filter((it) => `${it.name} ${it.desc}`.toLowerCase().includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  }, [menu.categories, q]);
  const allCategories = menu.categories.filter((c) => c.items.length > 0);
  const itemCount = allCategories.reduce((n, c) => n + c.items.length, 0);

  const jump = (i: number) => {
    setQuery("");
    requestAnimationFrame(() => document.getElementById(`${idBase}-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* header */}
      <header
        className="relative overflow-hidden rounded-3xl px-5 pb-5 pt-6 text-white shadow-xl"
        style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 62%, #000))` }}
      >
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-14 right-16 h-32 w-32 rounded-full bg-white/5" />
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
          <UtensilsCrossed className="h-3.5 w-3.5" /> Menu
        </p>
        {/* inside the maker the page already has its own h1, so the preview uses h2 */}
        <Heading className="mt-1 break-words text-[28px] font-extrabold leading-tight tracking-tight sm:text-3xl">{menu.name || "Our menu"}</Heading>
        {menu.tagline && <p className="mt-1 break-words text-sm text-white/85">{menu.tagline}</p>}
        {(menu.address || menu.hours) && (
          <div className="mt-3 space-y-1 text-[13px] text-white/85">
            {menu.address && (
              <p className="flex items-start gap-1.5 break-words">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {menu.address}
              </p>
            )}
            {menu.hours && (
              <p className="flex items-start gap-1.5 break-words">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {menu.hours}
              </p>
            )}
          </div>
        )}
        {(tel || wa) && (
          <div className="mt-4 flex gap-2">
            {tel && (
              <a
                href={tel}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold shadow-lg transition-transform active:scale-[0.97]"
                style={{ color: accent }}
              >
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.97]"
              >
                <BrandWhatsApp className="h-4 w-4" /> WhatsApp
              </a>
            )}
          </div>
        )}
      </header>

      {/* search + categories */}
      {itemCount > 0 && (
        <div className={`sticky z-20 -mx-1 mt-3 bg-[var(--bg)]/90 px-1 pb-2 pt-2 backdrop-blur ${embedded ? "top-0" : "top-16"}`}>
          <label className="relative block">
            <span className="sr-only">Search the menu</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 60))}
              placeholder={`Search ${itemCount} item${itemCount === 1 ? "" : "s"}…`}
              className="w-full rounded-2xl surface py-3 pl-10 pr-10 text-sm outline-none transition-colors focus:border-[color:var(--menu-accent)]"
              style={{ ["--menu-accent" as string]: accent }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-muted hover:text-[var(--fg)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          {allCategories.length > 1 && (
            <nav aria-label="Menu categories" className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {allCategories.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => jump(i)}
                  className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors"
                  style={{ borderColor: `color-mix(in oklab, ${accent} 45%, transparent)`, color: accentText }}
                >
                  {c.name || `Section ${i + 1}`}
                </button>
              ))}
            </nav>
          )}
        </div>
      )}

      {/* items */}
      <div className="mt-2 space-y-6">
        {itemCount === 0 && <p className="rounded-2xl surface p-6 text-center text-sm text-muted">This menu has no items yet.</p>}
        {itemCount > 0 && categories.length === 0 && (
          <p className="rounded-2xl surface p-6 text-center text-sm text-muted">
            Nothing matches “{query.trim()}”.{" "}
            <button type="button" onClick={() => setQuery("")} className="font-bold underline" style={{ color: accentText }}>
              Show everything
            </button>
          </p>
        )}
        {categories.map((c) => (
          <section key={c.index} id={`${idBase}-${c.index}`} className={embedded ? "scroll-mt-28" : "scroll-mt-44"}>
            {c.name && (
              <h2 className="mb-2 flex items-baseline gap-2 px-1 text-lg font-extrabold tracking-tight">
                <span className="h-4 w-1 self-center rounded-full" style={{ backgroundColor: accent }} aria-hidden />
                <span className="min-w-0 break-words">{c.name}</span>
                <span className="text-xs font-semibold text-muted">{c.items.length}</span>
              </h2>
            )}
            <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl surface">
              {c.items.map((it, j) => {
                const price = formatPrice(it.price, menu.currency);
                return (
                  <li key={j} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-bold leading-snug">{it.name}</p>
                      {it.desc && <p className="mt-0.5 break-words text-[13px] leading-snug text-muted">{it.desc}</p>}
                    </div>
                    {price && (
                      <span
                        className="max-w-[45%] shrink-0 break-words rounded-xl px-2.5 py-1 text-right text-sm font-extrabold"
                        style={{ color: accentText, backgroundColor: `color-mix(in oklab, ${accent} 12%, transparent)` }}
                      >
                        {price}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {menu.note && <p className="mt-5 break-words px-1 text-center text-xs text-muted">{menu.note}</p>}

      <p className="mt-6 pb-2 text-center text-xs text-muted">
        {embedded ? (
          <span>Make your own free QR menu on SnapGrab</span>
        ) : (
          <Link href="/tools/qr-menu-maker" className="font-semibold underline-offset-2 hover:underline">
            Make your own free QR menu on SnapGrab →
          </Link>
        )}
      </p>
    </div>
  );
}
