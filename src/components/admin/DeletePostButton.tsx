"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DeletePostButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    await fetch(`/api/admin/blogs?id=${id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  if (busy) return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />;

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <button onClick={remove} className="text-red-400 hover:underline">
          Confirm
        </button>
        <button onClick={() => setConfirming(false)} className="text-muted hover:underline">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-muted hover:text-red-400">
      Delete
    </button>
  );
}
