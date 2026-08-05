"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, MessageSquare, Save, Search, Undo2 } from "lucide-react";
import { Panel } from "./ui";

export type ServiceRow = {
  kind: "tool" | "platform";
  key: string;
  name: string;
  group: string;
  href: string;
  color: string;
  tagline: string;
  uses: number;
  enabled: boolean;
  note: string;
};

type Draft = { enabled: boolean; note: string };

export default function ServiceManager({ rows }: { rows: ServiceRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, Draft>>(
    Object.fromEntries(rows.map((r) => [r.key, { enabled: r.enabled, note: r.note }])),
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "hidden">("all");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);

  const original = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.key, { enabled: r.enabled, note: r.note }])),
    [rows],
  );

  const changed = useMemo(
    () =>
      rows.filter(
        (r) => draft[r.key].enabled !== original[r.key].enabled || draft[r.key].note !== original[r.key].note,
      ),
    [rows, draft, original],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = rows.filter((r) => {
      if (filter === "live" && !draft[r.key].enabled) return false;
      if (filter === "hidden" && draft[r.key].enabled) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.key.includes(q) || r.tagline.toLowerCase().includes(q);
    });
    const map = new Map<string, ServiceRow[]>();
    visible.forEach((r) => map.set(r.group, [...(map.get(r.group) ?? []), r]));
    return [...map.entries()];
  }, [rows, query, filter, draft]);

  function toggle(key: string) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], enabled: !d[key].enabled } }));
    setSaved(false);
  }

  function setNote(key: string, note: string) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], note } }));
    setSaved(false);
  }

  function bulk(groupRows: ServiceRow[], enabled: boolean) {
    setDraft((d) => {
      const next = { ...d };
      groupRows.forEach((r) => (next[r.key] = { ...next[r.key], enabled }));
      return next;
    });
    setSaved(false);
  }

  function revert() {
    setDraft(Object.fromEntries(rows.map((r) => [r.key, { ...original[r.key] }])));
    setSaved(false);
    setError(null);
  }

  async function save() {
    if (!changed.length || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/services", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          updates: changed.map((r) => ({
            kind: r.kind,
            key: r.key,
            enabled: draft[r.key].enabled,
            note: draft[r.key].note,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not save.");
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const hiddenCount = rows.filter((r) => !draft[r.key].enabled).length;

  return (
    <>
      <Panel
        title="Services"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services"
                className="w-44 rounded-lg surface py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-400"
              />
            </span>
            {(["all", "live", "hidden"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                  filter === f ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white" : "surface text-muted"
                }`}
              >
                {f}
                {f === "hidden" && hiddenCount ? ` (${hiddenCount})` : ""}
              </button>
            ))}
          </div>
        }
      >
        {groups.length === 0 && <p className="p-14 text-center text-sm text-muted">No services match that filter.</p>}

        {groups.map(([group, groupRows]) => (
          <div key={group} className="border-b border-[var(--line)] last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-soft)] px-5 py-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                {group} · {groupRows.length}
              </h3>
              <div className="flex gap-2 text-xs font-bold">
                <button onClick={() => bulk(groupRows, true)} className="text-muted transition-colors hover:text-accent-400">
                  Enable all
                </button>
                <span className="text-muted">·</span>
                <button onClick={() => bulk(groupRows, false)} className="text-muted transition-colors hover:text-red-400">
                  Disable all
                </button>
              </div>
            </div>

            <ul>
              {groupRows.map((r) => {
                const on = draft[r.key].enabled;
                const dirty = on !== original[r.key].enabled || draft[r.key].note !== original[r.key].note;
                return (
                  <li key={r.key} className={`border-b border-[var(--line)] last:border-0 ${dirty ? "bg-brand-500/5" : ""}`}>
                    <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: on ? r.color : "var(--line)" }} />

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-bold ${on ? "" : "text-muted line-through"}`}>{r.name}</span>
                          {dirty && (
                            <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-400">
                              unsaved
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {r.tagline} · {r.uses.toLocaleString()} use{r.uses === 1 ? "" : "s"}
                        </span>
                      </span>

                      <button
                        onClick={() => setNoteFor(noteFor === r.key ? null : r.key)}
                        title="Message shown to visitors when hidden"
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
                          draft[r.key].note ? "bg-amber-500/15 text-amber-400" : "text-muted hover:text-brand-400"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>

                      <Link
                        href={r.href}
                        target="_blank"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:text-brand-400"
                        title="Open the public page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>

                      <button
                        role="switch"
                        aria-checked={on}
                        aria-label={`${on ? "Disable" : "Enable"} ${r.name}`}
                        onClick={() => toggle(r.key)}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                          on ? "bg-gradient-to-r from-brand-500 to-accent-500" : "bg-[var(--bg-soft)] ring-1 ring-[var(--line)]"
                        }`}
                      >
                        <motion.span
                          layout
                          transition={{ type: "spring", stiffness: 500, damping: 32 }}
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${on ? "left-6" : "left-1"}`}
                        />
                      </button>
                    </div>

                    <AnimatePresence>
                      {noteFor === r.key && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4">
                            <input
                              value={draft[r.key].note}
                              onChange={(e) => setNote(r.key, e.target.value)}
                              maxLength={300}
                              placeholder="Optional message shown on the page while this service is hidden"
                              className="w-full rounded-xl surface px-4 py-2.5 text-sm outline-none focus:border-brand-400"
                            />
                            <p className="mt-1.5 text-xs text-muted">
                              Leave empty to show the default: &ldquo;This service is temporarily unavailable.&rdquo;
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Panel>

      {/* sticky save bar */}
      <AnimatePresence>
        {(changed.length > 0 || saved || error) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="sticky bottom-4 z-30"
          >
            <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4 shadow-2xl">
              {error ? (
                <span className="flex items-center gap-2 text-sm font-semibold text-red-400">
                  <AlertCircle className="h-4 w-4" /> {error}
                </span>
              ) : saved && !changed.length ? (
                <span className="flex items-center gap-2 text-sm font-semibold text-accent-400">
                  <CheckCircle2 className="h-4 w-4" /> Saved — the site is updated.
                </span>
              ) : (
                <span className="text-sm font-semibold">
                  {changed.length} unsaved change{changed.length === 1 ? "" : "s"}
                </span>
              )}

              {changed.length > 0 && (
                <>
                  <button
                    onClick={revert}
                    className="ml-auto flex items-center gap-1.5 rounded-xl surface px-4 py-2 text-sm font-bold text-muted transition-colors hover:text-[var(--fg)]"
                  >
                    <Undo2 className="h-4 w-4" /> Revert
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-brand-500/25 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Apply changes
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
