"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { trackEvent } from "@/lib/track-event";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "sg-install-dismissed";

/**
 * Registers the service worker (production only) and, when the browser says the site can be
 * installed, offers a small "Install app" card. Dismissing hides it for 30 days.
 */
export default function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      let dismissedAt = 0;
      try {
        dismissedAt = Number(localStorage.getItem(DISMISS_KEY)) || 0;
      } catch {}
      if (Date.now() - dismissedAt > 30 * 86_400_000) setPrompt(e as InstallEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      trackEvent("pwa-installed");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setPrompt(null);
  };

  return (
    <AnimatePresence>
      {prompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="glass fixed bottom-4 left-4 right-4 z-[90] flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3 shadow-2xl sm:left-6 sm:right-auto sm:w-96"
          role="dialog"
          aria-label="Install SnapGrab"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Install SnapGrab</p>
            <p className="text-xs text-muted">One tap from your home screen. Tools you open also work offline.</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await prompt.prompt();
              const { outcome } = await prompt.userChoice;
              trackEvent("pwa-prompt", outcome);
              setPrompt(null);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-3 py-2 text-xs font-bold text-white"
          >
            <Download className="h-4 w-4" /> Install
          </button>
          <button type="button" onClick={dismiss} aria-label="Not now" className="rounded-lg p-1 text-muted hover:text-[var(--fg)]">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
