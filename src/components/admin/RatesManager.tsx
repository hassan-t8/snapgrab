"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import { notify } from "@/components/Toaster";

type Def = { key: string; label: string; unit: string; latest: number | null };
type Row = { id: string; key: string; label: string; value: number; date: string };

const field =
  "w-full rounded-xl bg-[var(--bg-soft)] px-3.5 py-2.5 text-sm outline-none ring-1 ring-[var(--line)] focus:ring-brand-400";

export default function RatesManager({ defs, today, recent }: { defs: Def[]; today: string; recent: Row[] }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const payload: Record<string, number | null> = {};
    for (const d of defs) {
      const raw = (values[d.key] ?? "").replace(/[,\s]/g, "");
      payload[d.key] = raw ? Number(raw) : null;
      if (raw && !(Number(raw) > 0)) {
        notify.error(`${d.label}: enter a number`);
        return;
      }
    }
    if (!Object.values(payload).some((v) => v != null)) {
      notify.info("Nothing to save", "Type at least one price.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/rates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, values: payload }) });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; saved?: number } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Save failed (${res.status})`);
      notify.success(`Saved ${json.saved} price${json.saved === 1 ? "" : "s"}`, "The rate pages show them now.");
      setValues({});
      router.refresh();
    } catch (e) {
      notify.error("Not saved", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this price?")) return;
    const res = await fetch(`/api/admin/rates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      notify.success("Deleted");
      router.refresh();
    } else notify.error("Could not delete");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold">Enter today&apos;s prices</h2>
            <p className="mt-1 text-xs text-muted">Leave a box empty to skip it. Saving the same date again updates that day.</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {defs.map((d) => (
            <label key={d.key} className="block">
              <span className="mb-1 block text-sm font-semibold">
                {d.label} <span className="font-normal text-muted">({d.unit})</span>
              </span>
              <input
                value={values[d.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.value }))}
                inputMode="decimal"
                placeholder={d.latest ? `Last: ${d.latest.toLocaleString("en-PK")}` : "e.g. 250000"}
                className={field}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="mt-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save prices
        </button>
      </section>

      <section className="rounded-2xl surface">
        <h2 className="border-b border-[var(--line)] px-5 py-4 text-sm font-bold">Recent entries</h2>
        {recent.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No prices yet. Until you add some, the gold and petrol pages say “updating”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-5 py-2.5 text-muted">{r.date}</td>
                    <td className="px-5 py-2.5 font-semibold">{r.label}</td>
                    <td className="px-5 py-2.5 text-right font-bold">Rs {r.value.toLocaleString("en-PK")}</td>
                    <td className="w-12 px-3">
                      <button type="button" onClick={() => void remove(r.id)} aria-label="Delete" className="rounded-lg p-1.5 text-muted hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
