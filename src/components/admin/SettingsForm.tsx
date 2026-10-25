"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { SOCIALS } from "@/lib/socials";
import { notify } from "@/components/Toaster";

export default function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { error?: string } | null;
    setState(res?.ok ? "saved" : "error");
    if (res?.ok) notify.success("Settings saved");
    else notify.error("Could not save", json?.error);
    router.refresh();
  }

  const field =
    "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted focus:border-brand-400";

  return (
    <form onSubmit={save} className="space-y-4 p-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Site tagline</span>
        <input value={values.site_tagline} onChange={set("site_tagline")} className={field} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Public contact email</span>
        <input value={values.contact_email} onChange={set("contact_email")} className={field} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Announcement banner</span>
        <textarea
          rows={2}
          value={values.announcement}
          onChange={set("announcement")}
          className={`${field} resize-y`}
          placeholder="Leave empty to hide the banner."
        />
      </label>

      <fieldset className="rounded-2xl border border-[var(--line)] p-4">
        <legend className="px-1 text-sm font-bold">Social profiles</legend>
        <p className="mb-3 text-xs text-muted">
          Shown as icons in the footer and told to Google as your official profiles. Leave empty to hide an icon.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <label key={s.key} className="block">
              <span className="mb-1 block text-xs font-semibold">{s.label}</span>
              <input
                value={values[s.key] ?? ""}
                onChange={set(s.key)}
                placeholder={s.placeholder}
                inputMode="url"
                className={field}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <motion.button
          type="submit"
          whileTap={{ scale: 0.96 }}
          disabled={state === "saving"}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 disabled:opacity-60"
        >
          {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </motion.button>
        {state === "saved" && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 text-sm text-accent-400"
          >
            <CheckCircle2 className="h-4 w-4" /> Saved
          </motion.span>
        )}
        {state === "error" && <span className="text-sm text-red-400">Could not save.</span>}
      </div>
    </form>
  );
}
