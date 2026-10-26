"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { BrandWhatsApp } from "./BrandIcons";
import { notify } from "./Toaster";
import { trackEvent } from "@/lib/track-event";

const field =
  "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted focus:border-brand-400";

/**
 * "Get a free quote" form shown under a calculator. Sends the visitor's details plus a snapshot of
 * the calculation to /api/leads; afterwards offers a WhatsApp chat if the admin set a number.
 */
export default function LeadForm({
  kind,
  title,
  subtitle,
  details,
}: {
  kind: "solar";
  title: string;
  subtitle: string;
  details: Record<string, string | number>;
}) {
  const [form, setForm] = useState({ name: "", phone: "", city: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ whatsapp: string | null } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2 || !/^[+\d][\d\s-]{6,19}$/.test(form.phone.trim())) {
      notify.error("Please add your name and a phone number");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, ...form, details }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; whatsapp?: string | null } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Could not send — please try again.");
      trackEvent("lead", kind);
      setDone({ whatsapp: json.whatsapp ?? null });
    } catch (err) {
      notify.error("Not sent", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const summary = Object.entries(details)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    return (
      <div className="rounded-2xl border border-accent-500/30 bg-accent-500/10 p-5">
        <p className="flex items-center gap-2 font-bold text-accent-300">
          <CheckCircle2 className="h-5 w-5" /> Thanks, {form.name.split(" ")[0]}! We&apos;ll call you soon.
        </p>
        {done.whatsapp && (
          <a
            href={`https://wa.me/${done.whatsapp}?text=${encodeURIComponent(`Assalam o Alaikum, I'd like a solar quote.\nName: ${form.name}\nCity: ${form.city}\n${summary}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("lead-whatsapp", kind)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"
          >
            <BrandWhatsApp className="h-4 w-4" /> Chat on WhatsApp now
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-brand-400/30 bg-brand-500/5 p-5">
      <p className="font-extrabold">{title}</p>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input value={form.name} onChange={set("name")} placeholder="Your name" aria-label="Your name" autoComplete="name" className={field} />
        <input value={form.phone} onChange={set("phone")} placeholder="Phone / WhatsApp" aria-label="Phone or WhatsApp" inputMode="tel" autoComplete="tel" className={field} />
        <input value={form.city} onChange={set("city")} placeholder="City" aria-label="City" autoComplete="address-level2" className={field} />
      </div>
      <textarea value={form.message} onChange={set("message")} rows={2} placeholder="Anything else? (roof size, budget, net metering…)" aria-label="Message" className={`${field} mt-3`} />
      {/* honeypot: hidden from people, filled by bots */}
      <input value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Get my free quote
        </button>
        <span className="text-xs text-muted">Your calculation is attached. No spam — we only use your number to contact you about this quote.</span>
      </div>
    </form>
  );
}
