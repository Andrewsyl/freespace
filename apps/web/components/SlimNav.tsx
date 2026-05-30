"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

function initials(email?: string | null) {
  if (!email) return "?";
  return email.slice(0, 2).toUpperCase();
}

export function SlimNav() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E6E6E4] bg-[#F7F7F6] px-5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <img src="/freespace-logo.png" alt="FreeSpace" className="h-10 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 sm:flex">
          <NavLink href="/">Find parking</NavLink>
          <NavLink href="/host">List a space</NavLink>
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
            <Link
              href="/dashboard"
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              aria-label="My account"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          )}
        </nav>

        {/* Mobile menu button — morphs burger → × */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50 sm:hidden"
        >
          <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
            {/* Top bar — rotates to top-left → bottom-right diagonal */}
            <line
              x1="2" y1="5" x2="16" y2="5"
              className="origin-center transition-all duration-300"
              style={{
                transform: open ? "rotate(45deg) translate(0px, 4px)" : "none",
                transformOrigin: "9px 5px",
              }}
            />
            {/* Middle bar — fades out */}
            <line
              x1="2" y1="9" x2="16" y2="9"
              className="transition-all duration-300"
              style={{ opacity: open ? 0 : 1 }}
            />
            {/* Bottom bar — rotates to top-right → bottom-left diagonal */}
            <line
              x1="2" y1="13" x2="16" y2="13"
              className="origin-center transition-all duration-300"
              style={{
                transform: open ? "rotate(-45deg) translate(0px, -4px)" : "none",
                transformOrigin: "9px 13px",
              }}
            />
          </svg>
        </button>
      </header>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="fixed bottom-0 left-0 right-0 top-16 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            className="fixed bottom-0 left-0 right-0 top-16 z-50 flex flex-col bg-white shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
          >
              {/* Account card */}
              {user && (
                <div className="mx-5 mt-5 flex items-center gap-3.5 rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-slate-900">My account</p>
                    <p className="truncate text-[12px] text-slate-500">{user.email}</p>
                  </div>
                </div>
              )}

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-5 py-5">
                <div className="space-y-1">
                  <DrawerLink href="/" onClick={close} icon={<ParkingIcon />}>
                    Find parking
                  </DrawerLink>
                  <DrawerLink href="/host" onClick={close} icon={<ListIcon />}>
                    List a space
                  </DrawerLink>
                  <DrawerLink href="/dashboard" onClick={close} icon={<DashboardIcon />}>
                    Dashboard
                  </DrawerLink>
                  {user && (
                    <DrawerLink href="/dashboard/favorites" onClick={close} icon={<HeartIcon />}>
                      Favourites
                    </DrawerLink>
                  )}
                  <DrawerLink href="/help" onClick={close} icon={<HelpIcon />}>
                    Help
                  </DrawerLink>
                  {user?.role === "admin" && (
                    <DrawerLink href="/admin" onClick={close} icon={<AdminIcon />}>
                      Admin
                    </DrawerLink>
                  )}
                </div>
              </nav>

              {/* Footer: auth */}
              <div
                className="border-t border-slate-100 px-5 pt-4"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
              >
                {user ? (
                  <button
                    type="button"
                    onClick={() => { close(); signOut(); }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href="/login"
                      onClick={close}
                      className="flex items-center justify-center rounded-xl border border-slate-200 py-3.5 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/signup"
                      onClick={close}
                      className="flex items-center justify-center rounded-xl bg-brand-500 py-3.5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-brand-600"
                    >
                      Sign up
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function DrawerLink({
  href,
  onClick,
  icon,
  children,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as any}
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-[16px] font-semibold text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        {icon}
      </span>
      {children}
    </Link>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function ParkingIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
