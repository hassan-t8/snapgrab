"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastKind = "success" | "error" | "info" | "warning";

type ToastItem = { id: number; kind: ToastKind; title: string; body?: string; duration: number };

const EVENT = "sg:toast";
let nextId = 1;

/**
 * Show a toast from anywhere in client code — no provider or context needed:
 *   notify.success("Saved"), notify.error("Could not load rates", "Try again in a minute")
 * The <Toaster /> mounted in the layout listens for these.
 */
function emit(kind: ToastKind, title: string, body?: string, duration = kind === "error" ? 6000 : 3500) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastItem>(EVENT, { detail: { id: nextId++, kind, title, body, duration } }));
}

export const notify = {
  success: (title: string, body?: string) => emit("success", title, body),
  error: (title: string, body?: string) => emit("error", title, body),
  info: (title: string, body?: string) => emit("info", title, body),
  warning: (title: string, body?: string) => emit("warning", title, body),
};

const STYLE: Record<ToastKind, { icon: typeof Info; tone: string }> = {
  success: { icon: CheckCircle2, tone: "text-accent-400" },
  error: { icon: XCircle, tone: "text-red-400" },
  info: { icon: Info, tone: "text-brand-400" },
  warning: { icon: AlertTriangle, tone: "text-amber-400" },
};

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<ToastItem>).detail;
      setItems((prev) => [...prev.slice(-3), t]); // keep the stack short
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.duration);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const { icon: Icon, tone } = STYLE[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              role={t.kind === "error" ? "alert" : "status"}
              className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-[var(--line)] p-4 shadow-2xl"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
                className="shrink-0 rounded-lg p-1 text-muted hover:text-[var(--fg)]"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
