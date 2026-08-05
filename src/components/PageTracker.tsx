"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Records every route change as a page view (the visitor "foot steps" trail). */
export default function PageTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const payload = JSON.stringify({ path: pathname, first: first.current });
    first.current = false;

    fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
