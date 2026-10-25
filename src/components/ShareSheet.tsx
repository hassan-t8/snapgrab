"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Link2, Loader2, Mail, Share2, Smartphone } from "lucide-react";
import { BrandFacebook, BrandLinkedIn, BrandTelegram, BrandWhatsApp, BrandX } from "./BrandIcons";
import { notify } from "./Toaster";
import { trackEvent } from "@/lib/track-event";

/**
 * One Share button for every tool and page.
 *
 * - With `getFiles` (a photo, PDF …) on a phone, the system share sheet sends the file itself
 *   to WhatsApp, Gmail, Facebook, Bluetooth and so on.
 * - Otherwise it opens a menu that shares the link: WhatsApp, Facebook, X, Telegram, LinkedIn,
 *   email or copy. Desktop browsers cannot attach a file to WhatsApp Web, so there the result is
 *   downloaded and the link to the tool is shared.
 */
export default function ShareSheet({
  title,
  text,
  url,
  getFiles,
  label = "Share",
  className = "",
  variant = "button",
}: {
  title: string;
  text?: string;
  /** defaults to the current page */
  url?: string;
  /** builds the files to share (only called when the user taps Share) */
  getFiles?: () => Promise<File[]> | File[];
  label?: string;
  className?: string;
  variant?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const link = () => url ?? (typeof window !== "undefined" ? window.location.href.split("#")[0] : "");
  const message = () => `${text ?? title} — ${link()}`;

  async function onShare() {
    // a phone with file sharing: send the actual result
    if (getFiles && typeof navigator !== "undefined" && navigator.canShare) {
      setBusy(true);
      try {
        const files = await getFiles();
        if (files.length && navigator.canShare({ files })) {
          await navigator.share({ files, title, text: text ?? title });
          trackEvent("share", "file");
          return;
        }
      } catch (e) {
        // the user closing the sheet is not an error
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        setBusy(false);
      }
    }
    setOpen((v) => !v);
  }

  const go = (channel: string, href: string) => {
    trackEvent("share", channel);
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link();
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    trackEvent("share", "copy");
    setCopied(true);
    notify.success("Link copied", "Paste it anywhere to share.");
    setTimeout(() => setCopied(false), 1600);
  }

  async function native() {
    try {
      await navigator.share({ title, text: text ?? title, url: link() });
      trackEvent("share", "native");
    } catch {}
    setOpen(false);
  }

  const enc = encodeURIComponent;
  const channels = [
    { id: "whatsapp", label: "WhatsApp", icon: BrandWhatsApp, color: "#25D366", href: () => `https://wa.me/?text=${enc(message())}` },
    { id: "facebook", label: "Facebook", icon: BrandFacebook, color: "#1877F2", href: () => `https://www.facebook.com/sharer/sharer.php?u=${enc(link())}` },
    { id: "x", label: "X", icon: BrandX, color: "currentColor", href: () => `https://x.com/intent/post?text=${enc(text ?? title)}&url=${enc(link())}` },
    { id: "telegram", label: "Telegram", icon: BrandTelegram, color: "#26A5E4", href: () => `https://t.me/share/url?url=${enc(link())}&text=${enc(text ?? title)}` },
    { id: "linkedin", label: "LinkedIn", icon: BrandLinkedIn, color: "#0A66C2", href: () => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(link())}` },
    { id: "email", label: "Email", icon: Mail, color: "#EA4335", href: () => `mailto:?subject=${enc(title)}&body=${enc(message())}` },
  ];

  return (
    <div ref={box} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => void onShare()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={variant === "icon" ? label : undefined}
        className={
          variant === "icon"
            ? "grid h-9 w-9 place-items-center rounded-xl surface transition-colors hover:border-brand-400/60 hover:text-brand-400"
            : "flex items-center gap-2 rounded-xl surface px-4 py-2.5 text-sm font-bold transition-colors hover:border-brand-400/60 hover:text-brand-400"
        }
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        {variant === "button" && label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="glass absolute bottom-full right-0 z-50 mb-2 w-64 rounded-2xl border border-[var(--line)] p-2 shadow-2xl sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2"
          >
            <div className="grid grid-cols-3 gap-1">
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="menuitem"
                  onClick={() => go(c.id, c.href())}
                  className="flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-semibold transition-colors hover:bg-brand-500/10"
                >
                  <c.icon className="h-5 w-5" style={{ color: c.color }} />
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-1 grid gap-1 border-t border-[var(--line)] pt-1">
              <button type="button" role="menuitem" onClick={() => void copy()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-brand-500/10">
                {copied ? <Check className="h-4 w-4 text-accent-400" /> : <Link2 className="h-4 w-4" />}
                Copy link
              </button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button type="button" role="menuitem" onClick={() => void native()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-brand-500/10">
                  <Smartphone className="h-4 w-4" />
                  More apps…
                </button>
              )}
            </div>
            {getFiles && (
              <p className="px-3 pb-1 pt-2 text-[11px] leading-snug text-muted">
                On a computer this shares the link. To send the file itself, download it and attach it — or open SnapGrab on your phone.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Helpers for tools: turn a canvas or blob into a File for getFiles(). */
export const blobToFile = (blob: Blob, name: string) => new File([blob], name, { type: blob.type });

export const canvasToFile = (canvas: HTMLCanvasElement, name: string, type = "image/jpeg", quality = 0.92) =>
  new Promise<File>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(new File([b], name, { type })) : reject(new Error("Could not create the image."))), type, quality),
  );

/** Turns blob: / data: URLs produced by a tool into Files the share sheet can send. */
export async function urlsToFiles(items: { url: string; name: string }[]) {
  return Promise.all(items.map(async ({ url, name }) => blobToFile(await (await fetch(url)).blob(), name)));
}
