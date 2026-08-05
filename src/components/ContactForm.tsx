"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";

const SUBJECTS = ["General question", "A link failed", "Platform request", "Copyright / DMCA", "Advertising", "Other"];

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "", website: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setNote(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not send your message.");
      setState("sent");
      setNote(json.note ?? null);
      setForm({ name: "", email: "", subject: SUBJECTS[0], message: "", website: "" });
    } catch (err) {
      setState("error");
      setNote(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const field =
    "w-full rounded-xl surface px-4 py-3 text-sm outline-none transition-all placeholder:text-muted focus:border-brand-400 focus:shadow-[0_0_0_4px_rgba(112,72,240,.12)]";

  return (
    <form onSubmit={submit} className="rounded-[26px] surface p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Your name</span>
          <input required minLength={2} value={form.name} onChange={set("name")} className={field} placeholder="Jane Doe" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Email address</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={set("email")}
            className={field}
            placeholder="jane@example.com"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold">What is this about?</span>
        <select value={form.subject} onChange={set("subject")} className={field}>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold">Message</span>
        <textarea
          required
          minLength={10}
          rows={6}
          value={form.message}
          onChange={set("message")}
          className={`${field} resize-y`}
          placeholder="Tell us what happened, and paste the link you tried if a download failed."
        />
      </label>

      {/* honeypot — hidden from humans, catnip for bots */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={set("website")}
        className="hidden"
        aria-hidden
      />

      <motion.button
        type="submit"
        disabled={state === "loading"}
        whileHover={{ scale: state === "loading" ? 1 : 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-60"
      >
        {state === "loading" ? (
          <>
            <Loader2 className="h-[18px] w-[18px] animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="h-[18px] w-[18px]" /> Send message
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {state === "sent" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-start gap-3 rounded-xl border border-accent-500/30 bg-accent-500/10 p-4"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-400" />
            <div>
              <p className="font-semibold text-accent-400">Message received</p>
              <p className="mt-0.5 text-sm text-muted">
                {note ?? "We reply to almost everything within one business day. Check your inbox for a confirmation."}
              </p>
            </div>
          </motion.div>
        )}
        {state === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <p className="text-sm text-muted">{note}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
