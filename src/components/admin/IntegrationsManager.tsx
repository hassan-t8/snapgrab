"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Megaphone,
  RotateCcw,
  Save,
  Search,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Badge } from "./ui";
import { notify } from "@/components/Toaster";
import type { GroupId, GroupView, TestResult } from "@/lib/integrations";

const ICON: Record<GroupId, typeof KeyRound> = {
  rapidapi: KeyRound,
  smtp: Mail,
  adsense: Megaphone,
  google: Search,
  rates: TrendingUp,
};

const SOURCE_LABEL = { admin: "Saved here", env: "From .env", default: "Default", unset: "Not set" } as const;

const field =
  "w-full rounded-xl bg-[var(--bg-soft)] px-3.5 py-2.5 text-sm outline-none ring-1 ring-[var(--line)] transition-all placeholder:text-muted focus:ring-brand-400";

function ResultLine({ r, unsaved }: { r: TestResult; unsaved?: boolean }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${r.ok ? "bg-accent-500/10" : "bg-red-500/10"}`}>
      {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
      <div className="min-w-0">
        <p className={r.ok ? "text-accent-300" : "text-red-300"}>{r.message}</p>
        {r.detail && <p className="mt-1 break-words font-mono text-[11px] text-muted">{r.detail}</p>}
        <p className="mt-1 text-[11px] text-muted">
          {unsaved ? "Tested with unsaved values · " : ""}
          {formatDistanceToNow(new Date(r.at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function GroupCard({ initial }: { initial: GroupView }) {
  const [g, setG] = useState(initial);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [result, setResult] = useState<{ r: TestResult; unsaved: boolean } | null>(null);
  const Icon = ICON[g.id];
  const dirty = Object.keys(draft).length > 0;

  const set = (name: string, value: string) => setDraft((d) => ({ ...d, [name]: value }));

  async function save(values = draft) {
    setBusy("save");
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ group: g.id, values }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; groups?: GroupView[] } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Save failed (${res.status})`);
      const next = json.groups?.find((x) => x.id === g.id);
      if (next) setG(next);
      setDraft({});
      notify.success(`${g.title} saved`, "Live on the site within a few seconds.");
      return true;
    } catch (e) {
      notify.error("Not saved", e instanceof Error ? e.message : undefined);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    try {
      const res = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ group: g.id, values: draft, target: target || undefined }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; result?: TestResult; unsaved?: boolean } | null;
      if (!res.ok || !json?.ok || !json.result) throw new Error(json?.error ?? `Test failed (${res.status})`);
      setResult({ r: json.result, unsaved: !!json.unsaved });
      if (json.result.ok) notify.success("Test passed", json.result.message);
      else notify.error("Test failed", json.result.message);
    } catch (e) {
      notify.error("Could not run the test", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const shown = result ?? (g.lastTest ? { r: g.lastTest, unsaved: false } : null);

  return (
    <section className="rounded-2xl surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] p-5">
        <div className="flex min-w-0 gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              g.configured ? "bg-accent-500/15 text-accent-400" : "bg-amber-500/15 text-amber-400"
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 font-bold">
              {g.title}
              {g.required.length === 0 ? (
                <Badge tone="ok">No key needed</Badge>
              ) : g.configured ? (
                <Badge tone="ok">Configured</Badge>
              ) : (
                <Badge tone="warn">Not set up</Badge>
              )}
              {shown && <Badge tone={shown.r.ok ? "ok" : "bad"}>{shown.r.ok ? "Last test passed" : "Last test failed"}</Badge>}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{g.description}</p>
          </div>
        </div>
        <a href={g.docs} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-muted hover:text-brand-400">
          Get keys <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>

      <div className="space-y-4 p-5">
        {g.fields.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => {
              const value = draft[f.name] ?? (f.secret ? "" : f.value);
              return (
                <label key={f.name} className="block min-w-0">
                  <span className="mb-1.5 flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    {f.secret && <Lock className="h-3.5 w-3.5 text-muted" />}
                    {f.label}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        f.source === "admin" ? "bg-brand-500/15 text-brand-300" : f.source === "unset" ? "bg-amber-500/10 text-amber-400" : "bg-[var(--bg-soft)] text-muted"
                      }`}
                    >
                      {SOURCE_LABEL[f.source]}
                    </span>
                  </span>
                  {f.kind === "boolean" ? (
                    <select value={value || "false"} onChange={(e) => set(f.name, e.target.value)} className={field}>
                      <option value="true">On (SSL — port 465)</option>
                      <option value="false">Off (STARTTLS — port 587)</option>
                    </select>
                  ) : (
                    <span className="relative block">
                      <input
                        type={f.secret && !reveal[f.name] ? "password" : "text"}
                        value={value}
                        onChange={(e) => set(f.name, e.target.value)}
                        placeholder={f.secret && f.masked ? `Saved (${f.masked}) — type to replace` : f.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                        inputMode={f.kind === "number" ? "numeric" : undefined}
                        className={`${field} ${f.secret ? "pr-10" : ""}`}
                      />
                      {f.secret && (
                        <button
                          type="button"
                          onClick={() => setReveal((r) => ({ ...r, [f.name]: !r[f.name] }))}
                          aria-label={reveal[f.name] ? "Hide" : "Show what you typed"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-[var(--fg)]"
                        >
                          {reveal[f.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </span>
                  )}
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
                    {f.unreadable && <span className="text-red-400">Saved value can&apos;t be decrypted (AUTH_SECRET changed) — enter it again.</span>}
                    {f.hint && <span>{f.hint}</span>}
                    {f.source === "admin" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove the saved ${f.label}? The site falls back to .env (or nothing).`)) void save({ [f.name]: "" });
                        }}
                        className="font-semibold text-muted underline hover:text-red-400"
                      >
                        Remove saved value
                      </button>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {(g.id === "rapidapi" || g.id === "smtp") && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">{g.id === "rapidapi" ? "Test link (optional)" : "Send the test email to"}</span>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={g.id === "rapidapi" ? "Defaults to a short public YouTube video" : "Defaults to the “Send contact messages to” address"}
              className={field}
            />
          </label>
        )}

        <AnimatePresence>
          {shown && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ResultLine r={shown.r} unsaved={shown.unsaved} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-2">
          {g.fields.length > 0 && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || !!busy}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          )}
          <button
            type="button"
            onClick={() => void test()}
            disabled={!!busy}
            className="flex items-center gap-1.5 rounded-xl surface px-4 py-2 text-sm font-bold transition-colors hover:border-brand-400/60 disabled:opacity-50"
          >
            {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {dirty ? "Test before saving" : "Test"}
          </button>
          {dirty && (
            <button type="button" onClick={() => setDraft({})} className="flex items-center gap-1 px-2 text-xs font-bold text-muted hover:text-[var(--fg)]">
              <RotateCcw className="h-3.5 w-3.5" /> Discard changes
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function IntegrationsManager({ groups }: { groups: GroupView[] }) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <GroupCard key={g.id} initial={g} />
      ))}
    </div>
  );
}
