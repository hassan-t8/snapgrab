"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, Menu, X } from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // close every menu on navigation — done from the handlers, not an effect
  const closeMenus = () => {
    setOpen(false);
    setToolsOpen(false);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass shadow-[0_8px_30px_-12px_rgba(0,0,0,.35)]" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="SnapGrab home">
          <motion.span
            whileHover={{ rotate: -8, scale: 1.06 }}
            transition={{ type: "spring", stiffness: 340, damping: 14 }}
            className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-lg shadow-brand-500/25"
          >
            <Download className="h-[18px] w-[18px] text-white" />
          </motion.span>
          <span className="text-lg font-extrabold tracking-tight">
            Snap<span className="gradient-text">Grab</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.slice(0, 1).map((l) => (
            <NavLink key={l.href} {...l} active={pathname === l.href} onClick={closeMenus} />
          ))}

          <div className="relative" onMouseEnter={() => setToolsOpen(true)} onMouseLeave={() => setToolsOpen(false)}>
            <button
              className={`flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                pathname.startsWith("/download") ? "text-brand-400" : "text-muted hover:text-[var(--fg)]"
              }`}
              onClick={() => setToolsOpen((v) => !v)}
              aria-expanded={toolsOpen}
            >
              Downloaders
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {toolsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="absolute left-1/2 top-full z-50 w-[560px] -translate-x-1/2 pt-3"
                >
                  <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-2 shadow-2xl">
                    {PLATFORMS.map((p) => (
                      <Link
                        key={p.id}
                        href={`/download/${p.slug}`}
                        onClick={closeMenus}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-brand-500/10"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: p.color, boxShadow: `0 0 12px ${p.color}80` }}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{p.name}</span>
                          <span className="block truncate text-xs text-muted">{p.blurb}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {LINKS.slice(1).map((l) => (
            <NavLink
              key={l.href}
              {...l}
              active={pathname === l.href || pathname.startsWith(l.href + "/")}
              onClick={closeMenus}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/#downloader"
            onClick={closeMenus}
            className="hidden rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-transform hover:scale-[1.03] active:scale-95 sm:block"
          >
            Download now
          </Link>
          <button
            className="grid h-9 w-9 place-items-center rounded-xl surface md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-[var(--line)] glass md:hidden"
          >
            <div className="max-h-[calc(100vh-4rem)] space-y-1 overflow-y-auto px-4 py-4">
              {LINKS.map((l, i) => (
                <motion.div
                  key={l.href}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  <Link
                    href={l.href}
                    onClick={closeMenus}
                    className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-brand-500/10"
                  >
                    {l.label}
                  </Link>
                </motion.div>
              ))}
              <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-muted">Downloaders</p>
              <div className="grid grid-cols-2 gap-1">
                {PLATFORMS.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * i }}
                  >
                    <Link
                      href={`/download/${p.slug}`}
                      onClick={closeMenus}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-brand-500/10"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      {p.name}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
        active ? "text-brand-400" : "text-muted hover:text-[var(--fg)]"
      }`}
    >
      {label}
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
        />
      )}
    </Link>
  );
}
