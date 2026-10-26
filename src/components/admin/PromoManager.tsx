"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "./ui";
import { notify } from "@/components/Toaster";

export type PromoRow = { id: string; title: string; body: string; url: string; cta: string; categories: string[]; active: boolean; clicks: number };

const field =
  "w-full rounded-xl bg-[var(--bg-soft)] px-3.5 py-2.5 text-sm outline-none ring-1 ring-[var(--line)] focus:ring-brand-400";
const EMPTY = { title: "", body: "", url: "", cta: "View deal", categories: [] as string[], active: true };

export default function PromoManager({ promos, categories }: { promos: PromoRow[]; categories: string[] }) {
  const router = useRouter();
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/promos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Save failed");
      notify.success(form.id ? "Updated" : "Added", "It shows on matching tool pages now.");
      setForm(EMPTY);
      router.refresh();
    } catch (e) {
      notify.error("Not saved", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this promotion?")) return;
    await fetch(`/api/admin/promos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  }

  const toggleCat = (c: string) =>
    setForm((f) => ({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] }));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl surface p-5">
        <h2 className="font-bold">{form.id ? "Edit promotion" : "Add a sponsored or affiliate link"}</h2>
        <p className="mt-1 text-xs text-muted">
          Shown as a labelled “Sponsored” box on tool pages. Use your affiliate links (e.g. Daraz, Amazon) or a partner offer such as a
          solar installer. Links are marked sponsored/nofollow, as Google requires.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title — e.g. Glossy 4×6 photo paper, 100 sheets" className={field} />
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://your-affiliate-link" inputMode="url" className={field} />
          <input value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Short line (optional)" className={field} />
          <input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} placeholder="Button text" className={field} />
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold">Show on (none selected = every tool page)</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCat(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${form.categories.includes(c) ? "bg-brand-500 text-white" : "bg-[var(--bg-soft)] text-muted ring-1 ring-[var(--line)]"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-brand-500" />
          Active
        </label>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => void save()} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {form.id ? "Save changes" : "Add"}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm(EMPTY)} className="rounded-xl surface px-4 py-2.5 text-sm font-bold">
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl surface">
        <h2 className="border-b border-[var(--line)] px-5 py-4 text-sm font-bold">{promos.length} promotions</h2>
        {promos.length === 0 && <p className="p-8 text-center text-sm text-muted">None yet.</p>}
        <ul>
          {promos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-3 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {p.title} {p.active ? <Badge tone="ok">active</Badge> : <Badge>paused</Badge>}
                </span>
                <span className="block truncate text-xs text-muted">
                  {p.categories.length ? p.categories.join(", ") : "all tools"} · {p.clicks.toLocaleString()} clicks · {p.url}
                </span>
              </span>
              <button type="button" onClick={() => setForm({ ...p })} aria-label="Edit" className="rounded-lg p-2 text-muted hover:text-brand-400">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => void remove(p.id)} aria-label="Delete" className="rounded-lg p-2 text-muted hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
