"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, QrCode } from "lucide-react";
import QrMenuView from "@/components/QrMenuView";
import { decodeMenu, type DecodeResult } from "@/lib/qr-menu";

type State = { status: "loading" } | DecodeResult;

const MESSAGES: Record<Exclude<DecodeResult, { ok: true }>["reason"], { title: string; body: string }> = {
  empty: {
    title: "No menu in this link",
    body: "Menu links made with SnapGrab carry the whole menu after the # sign. Scan the restaurant's QR code again, or ask them to resend the link.",
  },
  "too-long": {
    title: "This menu link is too large",
    body: "The link is longer than a QR menu can be. Ask the restaurant to shorten their item descriptions and make a new QR code.",
  },
  unsupported: {
    title: "Please update your browser",
    body: "This menu is compressed, and your browser is too old to open it. Update Chrome, Safari or your phone's browser and scan again.",
  },
  invalid: {
    title: "This menu link is damaged",
    body: "Part of the link seems to be missing — it may have been cut off when it was copied. Scan the QR code again, or ask the restaurant for a fresh link.",
  },
};

export default function MenuViewer() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await decodeMenu(window.location.hash);
      if (cancelled) return;
      setState(result);
      if (result.ok && result.menu.name) document.title = `${result.menu.name} — Menu`;
    };
    const raf = requestAnimationFrame(() => void load());
    const onHash = () => void load();
    window.addEventListener("hashchange", onHash);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  if ("status" in state) {
    return (
      <div className="mx-auto grid min-h-[50vh] max-w-xl place-items-center" role="status" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the menu…
        </p>
      </div>
    );
  }

  if (!state.ok) {
    const msg = MESSAGES[state.reason];
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl surface p-6 text-center sm:p-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight">{msg.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{msg.body}</p>
          <Link
            href="/tools/qr-menu-maker"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25"
          >
            <QrCode className="h-4 w-4" /> Make a free QR menu
          </Link>
        </div>
      </div>
    );
  }

  return <QrMenuView menu={state.menu} />;
}
