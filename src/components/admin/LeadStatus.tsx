"use client";

import { useState } from "react";
import { notify } from "@/components/Toaster";

const STATUSES = ["new", "contacted", "closed"] as const;

export default function LeadStatus({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  return (
    <select
      value={value}
      aria-label="Lead status"
      onChange={async (e) => {
        const next = e.target.value;
        setValue(next);
        const res = await fetch("/api/admin/leads", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status: next }) });
        if (!res.ok) {
          setValue(status);
          notify.error("Could not update the lead");
        }
      }}
      className="rounded-lg bg-[var(--bg-soft)] px-2 py-1.5 text-xs font-bold ring-1 ring-[var(--line)]"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
