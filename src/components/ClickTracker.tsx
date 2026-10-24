"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/track-event";

/**
 * Site-wide click tracking that needs no per-component code:
 *   - outbound links      → "outbound" with the destination host
 *   - [data-track="name"] → that name, with optional data-track-label
 */
export default function ClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const tagged = target?.closest?.("[data-track]");
      if (tagged) {
        trackEvent(tagged.getAttribute("data-track") ?? "click", tagged.getAttribute("data-track-label") ?? undefined);
        return;
      }
      const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download")) return;
      try {
        const url = new URL(a.href, window.location.href);
        if (/^https?:$/.test(url.protocol) && url.host !== window.location.host) trackEvent("outbound", url.host);
      } catch {
        // malformed href: nothing to record
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
