"use client";

import { useEffect, useRef } from "react";
import { useAdsConfig } from "./AdsConfig";

type Props = {
  slot?: string;
  format?: string;
  className?: string;
  label?: string;
};

/**
 * AdSense slot. Set the publisher and slot IDs in Admin → Integrations to go live;
 * without them it renders a neutral reserved block so layout never shifts
 * (and so the page passes AdSense review with real content around it).
 */
export default function AdSlot({ slot: slotProp, format = "auto", className = "", label = "Advertisement" }: Props) {
  const ads = useAdsConfig();
  const client = ads.client;
  const slot = slotProp ?? ads.slot;
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!client || !slot || pushed.current) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
      pushed.current = true;
    } catch {}
  }, [client, slot]);

  if (!client || !slot) {
    return (
      <div
        className={`grid min-h-[90px] place-items-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg-soft)]/60 text-[11px] uppercase tracking-[0.2em] text-muted ${className}`}
        aria-hidden
      >
        {label}
      </div>
    );
  }

  return (
    <div className={className}>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
