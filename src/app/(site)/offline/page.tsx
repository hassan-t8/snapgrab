import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "You are offline", robots: { index: false, follow: false } };

/** Shown by the service worker when a page that was never opened before is requested offline. */
export default function Offline() {
  return (
    <section className="grid min-h-[60vh] place-items-center px-4 py-20">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-400">
          <WifiOff className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">You&apos;re offline</h1>
        <p className="mt-3 text-[15px] text-muted">
          This page hasn&apos;t been saved for offline use yet. Tools you opened before still work — try one from your list, or
          reconnect and try again.
        </p>
        <Link href="/tools" className="mt-6 inline-block rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3 font-bold text-white">
          Open my tools
        </Link>
      </div>
    </section>
  );
}
