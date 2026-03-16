"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

export function SlimNav() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (open && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
      <Link href="/" className="flex items-center gap-3">
        <img src="/freespace-logo.png" alt="FreeSpace" className="h-9 w-auto" />
      </Link>
      <nav className="hidden items-center gap-4 text-sm font-semibold text-slate-600 sm:flex">
        <Link href="/search" className="hover:text-slate-900">Find parking</Link>
        <Link href="/host" className="hover:text-slate-900">List a space</Link>
        <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
        {user?.role === "admin" && <Link href="/admin" className="hover:text-slate-900">Admin</Link>}
        <a href="/help" className="hover:text-slate-900">Help</a>
        {user ? (
          <button
            type="button"
            onClick={signOut}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 hover:border-slate-300"
          >
            Logout
          </button>
        ) : (
          <>
            <Link href="/login" className="hover:text-slate-900">Login</Link>
            <Link
              href="/signup"
              className="rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-slate-400"
            >
              Sign up
            </Link>
          </>
        )}
      </nav>
      <div className="relative sm:hidden" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            >
            <Link href="/search" className="block px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
              Find parking
            </Link>
            <Link href="/host" className="block px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
              List a space
            </Link>
            <Link href="/dashboard" className="block px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
              Dashboard
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin" className="block px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
                Admin
              </Link>
            )}
            <a href="/help" className="block px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
              Help
            </a>
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="block w-full px-4 py-3 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Logout
              </button>
            ) : (
              <>
                <Link href="/login" className="block px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
                  Login
                </Link>
                <Link href="/signup" className="block px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
                  Sign up
                </Link>
              </>
            )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
