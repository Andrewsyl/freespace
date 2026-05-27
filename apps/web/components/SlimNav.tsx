"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

function initials(email?: string | null) {
  if (!email) return "?";
  return email.slice(0, 2).toUpperCase();
}

export function SlimNav() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (open && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-7 py-4 backdrop-blur-md">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
        <img src="/freespace-logo.png" alt="FreeSpace" className="h-10 w-auto" />
      </Link>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-2 sm:flex">
        <NavLink href="/search">Find parking</NavLink>
        <NavLink href="/host">List a space</NavLink>
        <NavLink href="/dashboard">Dashboard</NavLink>
        {user && <NavLink href="/dashboard/favorites">Favourites</NavLink>}
        {user?.role === "admin" && <NavLink href="/admin">Admin</NavLink>}
        <NavLink href="/help">Help</NavLink>
        <div className="ml-2 h-4 w-px bg-slate-200" />

        {user ? (
          <button
            type="button"
            onClick={signOut}
            className="ml-2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Log out
          </button>
        ) : (
          <>
            <Link
              href="/login"
              className="ml-2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="ml-2 rounded-full bg-brand-500 px-5 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              Sign up
            </Link>
          </>
        )}

        {user && (
          <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-[12px] font-bold text-white shadow-sm">
            {initials(user.email)}
          </div>
        )}
      </nav>

      {/* Mobile hamburger */}
      <div className="relative sm:hidden" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50"
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 mt-2 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
            >
              {user && (
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[12px] font-bold text-white">
                    {initials(user.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-800">Account</p>
                    <p className="truncate text-[11px] text-slate-500">{user.email}</p>
                  </div>
                </div>
              )}

              <div className="py-1">
                <MobileNavLink href="/search" onClick={() => setOpen(false)}>Find parking</MobileNavLink>
                <MobileNavLink href="/host" onClick={() => setOpen(false)}>List a space</MobileNavLink>
                <MobileNavLink href="/dashboard" onClick={() => setOpen(false)}>Dashboard</MobileNavLink>
                {user && <MobileNavLink href="/dashboard/favorites" onClick={() => setOpen(false)}>Favourites</MobileNavLink>}
                {user?.role === "admin" && <MobileNavLink href="/admin" onClick={() => setOpen(false)}>Admin</MobileNavLink>}
                <MobileNavLink href="/help" onClick={() => setOpen(false)}>Help</MobileNavLink>
              </div>

              <div className="border-t border-slate-100 py-1">
                {user ? (
                  <button
                    type="button"
                    onClick={() => { setOpen(false); signOut(); }}
                    className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    Log out
                  </button>
                ) : (
                  <>
                    <MobileNavLink href="/login" onClick={() => setOpen(false)}>Log in</MobileNavLink>
                    <MobileNavLink href="/signup" onClick={() => setOpen(false)}>Sign up</MobileNavLink>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href as any}
      className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as any}
      onClick={onClick}
      className="block px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}
