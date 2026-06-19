"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toaster";
import { User, MapPin, Home, LayoutGrid, Heart, HelpCircle, Settings, LogOut } from "lucide-react";

function initials(email?: string | null) {
  if (!email) return "?";
  return email.slice(0, 2).toUpperCase();
}

export function SlimNav() {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const handleSignOut = () => {
    signOut();
    showToast("You've been signed out", "info");
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E6E6E4] bg-[#F7F7F6] px-5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <img src="/freespace-logo-grid-black.png" alt="FreeSpace" className="h-11 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 sm:flex">
          <NavLink href="/">Find parking</NavLink>
          <NavLink href="/host">List a space</NavLink>
          {user && <NavLink href="/bookings">My Bookings</NavLink>}
          <div className="ml-2 h-4 w-px bg-slate-200" />

          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
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
              <User className="h-[18px] w-[18px]" strokeWidth={1.75} />
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
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600">
                    <User className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-slate-900">My account</p>
                    <p className="truncate text-[12px] text-slate-600">{user.email}</p>
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
                  <DrawerLink href="/support" onClick={close} icon={<HelpIcon />}>
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
                    onClick={() => { close(); handleSignOut(); }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} />
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

function ParkingIcon() { return <MapPin className="h-5 w-5" strokeWidth={2} />; }
function ListIcon() { return <Home className="h-5 w-5" strokeWidth={2} />; }
function DashboardIcon() { return <LayoutGrid className="h-5 w-5" strokeWidth={2} />; }
function HeartIcon() { return <Heart className="h-5 w-5" strokeWidth={2} />; }
function HelpIcon() { return <HelpCircle className="h-5 w-5" strokeWidth={2} />; }
function AdminIcon() { return <Settings className="h-5 w-5" strokeWidth={2} />; }
