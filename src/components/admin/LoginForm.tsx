"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Download, Loader2, Lock, Mail } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Sign in failed.");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-xl surface py-3 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-muted focus:border-brand-400 focus:shadow-[0_0_0_4px_rgba(112,72,240,.12)]";

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 animate-blob rounded-full bg-brand-500/25 blur-[110px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-lg shadow-brand-500/30">
            <Download className="h-5 w-5 text-white" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted">Dashboard, analytics and content management.</p>
        </div>

        <form onSubmit={submit} className="glass rounded-[24px] p-6">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Email</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="admin@snapgrab.app"
              />
            </span>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold">Password</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
                placeholder="••••••••"
              />
            </span>
          </label>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 py-3 font-bold text-white shadow-lg shadow-brand-500/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Credentials come from <code className="font-mono">ADMIN_EMAIL</code> /{" "}
          <code className="font-mono">ADMIN_PASSWORD</code> in your env, applied by <code className="font-mono">npm run seed</code>.
        </p>
      </motion.div>
    </div>
  );
}
