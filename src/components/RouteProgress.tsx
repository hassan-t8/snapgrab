"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin progress bar at the top of the window while the next page loads, so a click
 * always feels acknowledged. It starts on any internal link click and finishes when the
 * URL actually changes. The bar is driven through a ref (no re-renders per tick).
 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const bar = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const value = useRef(0);

  const paint = (pct: number, visible = true) => {
    const el = bar.current;
    if (!el) return;
    el.style.transform = `scaleX(${pct / 100})`;
    el.style.opacity = visible ? "1" : "0";
  };

  const stopTimer = () => {
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = null;
  };

  const start = () => {
    stopTimer();
    value.current = 8;
    paint(value.current);
    // creep towards 90% — slower the closer it gets, so it never looks finished early
    timer.current = window.setInterval(() => {
      value.current += (90 - value.current) * 0.08;
      paint(value.current);
    }, 200);
  };

  const finish = () => {
    if (timer.current == null && value.current === 0) return;
    stopTimer();
    paint(100);
    window.setTimeout(() => {
      paint(100, false);
      window.setTimeout(() => {
        value.current = 0;
        paint(0, false);
      }, 250);
    }, 180);
  };

  // URL changed: the new page has rendered
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // same page (or just a hash jump): nothing will load
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
      // never leave the bar hanging if a navigation is cancelled or fails
      window.setTimeout(finish, 12_000);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[110] h-[3px]">
      <div
        ref={bar}
        className="h-full origin-left bg-gradient-to-r from-brand-500 via-accent-400 to-brand-400 shadow-[0_0_10px_var(--color-brand-500)]"
        style={{ transform: "scaleX(0)", opacity: 0, transition: "transform .2s ease, opacity .25s ease" }}
      />
    </div>
  );
}

export default function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
