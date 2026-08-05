"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Send } from "lucide-react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("loading");
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
    if (res?.ok) setEmail("");
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="min-w-0 flex-1 rounded-xl surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-brand-400"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
          aria-label="Subscribe"
        >
          {state === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === "done" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <AnimatePresence>
        {state === "done" && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-xs text-accent-400"
          >
            You are on the list. Welcome aboard.
          </motion.p>
        )}
        {state === "error" && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-red-400">
            That did not go through. Please try again.
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
