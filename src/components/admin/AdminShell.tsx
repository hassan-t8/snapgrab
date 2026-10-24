"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Download,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  MousePointerClick,
  Mail,
  Menu,
  Settings,
  ToggleLeft,
  Users,
  Wrench,
  X,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import type { AdminSession } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/downloads", label: "Downloads", icon: Download },
  { href: "/admin/visitors", label: "Visitors", icon: Users },
  { href: "/admin/tools", label: "Tools usage", icon: Wrench },
  { href: "/admin/events", label: "Clicks & events", icon: MousePointerClick },
  { href: "/admin/api-usage", label: "API usage", icon: Activity },
  { href: "/admin/blogs", label: "Blog posts", icon: FileText },
  { href: "/admin/messages", label: "Messages", icon: Mail },
  { href: "/admin/subscribers", label: "Subscribers", icon: BarChart3 },
  { href: "/admin/services", label: "Services & API limits", icon: ToggleLeft },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminShell({ session, children }: { session: AdminSession; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500">
          <Download className="h-[18px] w-[18px] text-white" />
        </span>
        <span>
          <span className="block text-sm font-extrabold leading-tight">SnapGrab</span>
          <span className="block text-[11px] text-muted">Control panel</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "text-white" : "text-muted hover:bg-brand-500/10 hover:text-[var(--fg)]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="admin-active"
                  className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 p-3">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-brand-400"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View live site
        </Link>
        <div className="rounded-xl surface p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">
              {session.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold">{session.name}</span>
              <span className="block truncate text-[11px] text-muted">{session.email}</span>
            </span>
          </div>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] py-2 text-xs font-semibold text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--bg-soft)]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-[var(--line)] bg-[var(--bg)] lg:block">
        {sidebar}
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-[var(--line)] bg-[var(--bg)] lg:hidden"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)]/85 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-xl surface lg:hidden"
            aria-label="Toggle sidebar"
          >
            {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>
          <h1 className="text-sm font-bold">{NAV.find((n) => isActive(n.href))?.label ?? "Admin"}</h1>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
