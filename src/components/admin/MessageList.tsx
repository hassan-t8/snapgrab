"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Reply, Trash2 } from "lucide-react";
import { Badge } from "./ui";

export type AdminMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string | null;
  handled: boolean;
  createdAt: string;
};

export default function MessageList({ messages }: { messages: AdminMessage[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(messages[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleHandled(m: AdminMessage) {
    setBusy(m.id);
    await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: m.id, handled: !m.handled }),
    }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(id);
    await fetch(`/api/admin/messages?id=${id}`, { method: "DELETE" }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  if (messages.length === 0) {
    return <p className="p-14 text-center text-sm text-muted">No messages yet.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--line)]">
      {messages.map((m) => (
        <li key={m.id}>
          <button
            onClick={() => setOpen(open === m.id ? null : m.id)}
            className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-brand-500/5"
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white ${
                m.handled ? "bg-[var(--bg-soft)] text-muted" : "bg-gradient-to-br from-brand-500 to-accent-500"
              }`}
            >
              {m.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{m.name}</span>
                <Badge tone={m.handled ? "ok" : "warn"}>{m.handled ? "handled" : "new"}</Badge>
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                {m.subject} · {m.email}
              </span>
            </span>
            <span className="hidden whitespace-nowrap text-xs text-muted sm:block">{m.createdAt}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open === m.id ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence initial={false}>
            {open === m.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5">
                  <p className="whitespace-pre-wrap rounded-xl bg-[var(--bg-soft)] p-4 text-sm leading-relaxed">
                    {m.message}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-muted">
                      IP <span className="font-mono">{m.ip ?? "unknown"}</span> · {m.createdAt}
                    </span>
                    <a
                      href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`}
                      className="ml-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-accent-500 px-3 py-1.5 font-bold text-white"
                    >
                      <Reply className="h-3.5 w-3.5" /> Reply
                    </a>
                    <button
                      onClick={() => toggleHandled(m)}
                      disabled={busy === m.id}
                      className="flex items-center gap-1.5 rounded-lg surface px-3 py-1.5 font-bold transition-colors hover:border-accent-500/50 hover:text-accent-400 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> {m.handled ? "Mark as new" : "Mark handled"}
                    </button>
                    <button
                      onClick={() => remove(m.id)}
                      disabled={busy === m.id}
                      className="flex items-center gap-1.5 rounded-lg surface px-3 py-1.5 font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </li>
      ))}
    </ul>
  );
}
