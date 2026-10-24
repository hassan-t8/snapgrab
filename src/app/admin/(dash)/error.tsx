"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
      <TriangleAlert className="mx-auto h-8 w-8 text-red-400" />
      <h1 className="mt-4 text-xl font-extrabold">This admin page failed to load</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {error.message || "Unexpected error."} Check the database connection and server logs if it keeps happening.
      </p>
      {error.digest && <p className="mt-1 text-xs text-muted">Reference: {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white"
      >
        <RotateCcw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}
