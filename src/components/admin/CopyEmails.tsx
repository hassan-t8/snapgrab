"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyEmails({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <button
      onClick={copy}
      disabled={!emails.length}
      className="flex items-center gap-1.5 rounded-lg surface px-3 py-1.5 text-xs font-bold transition-colors hover:border-brand-400/60 disabled:opacity-50"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy all emails"}
    </button>
  );
}
