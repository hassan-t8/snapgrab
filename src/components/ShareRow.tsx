"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { BrandX } from "./BrandIcons";

export default function ShareRow({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API needs a secure context — fall back so the button still works over http
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function nativeShare() {
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => {});
    } else {
      void copy();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl surface p-4">
      <span className="text-sm font-semibold">Share this article</span>
      <div className="ml-auto flex gap-2">
        <a
          href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
          className="grid h-9 w-9 place-items-center rounded-xl surface transition-colors hover:border-brand-400/60 hover:text-brand-400"
        >
          <BrandX className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={copy}
          aria-label="Copy link"
          className="grid h-9 w-9 place-items-center rounded-xl surface transition-colors hover:border-brand-400/60 hover:text-brand-400"
        >
          <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            {copied ? <Check className="h-4 w-4 text-accent-400" /> : <Link2 className="h-4 w-4" />}
          </motion.span>
        </button>
        <button
          onClick={nativeShare}
          aria-label="Share"
          className="grid h-9 w-9 place-items-center rounded-xl surface transition-colors hover:border-brand-400/60 hover:text-brand-400"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
