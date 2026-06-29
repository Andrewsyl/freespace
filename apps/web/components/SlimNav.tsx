"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toaster";
import { getHostListings } from "../lib/api";
import {
  BarChart3,
  CalendarCheck,
  Car,
  Heart,
  HelpCircle,
  LayoutGrid,
  LogOut,
  MapPin,
  PlusCircle,
  Settings,
  Shield,
  UserRound,
} from "lucide-react";

function accountInitial(name?: string | null, email?: string | null) {
  return name?.trim()?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || "?";
}

function isHostPath(p: string | null) {
  return !!p?.startsWith("/host");
}

const HOST_SEEN_KEY = "fs_host_seen";

export function SlimNav() {
  const { user, token, signOut } = useAuth();
  const { showToast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hostMode = isHostPath(pathname);
  const logoSrc = "/freespace-logo-grid-black.png";

  // Host is a role/intent, not a function of the current listing count. Once a
  // user has a listing OR steps into the host area, the "Switch to hosting"
  // entry should persist — even mid-onboarding or after deleting their last
  // space — so the way back never silently disappears. Cleared on sign-out.
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(HOST_SEEN_KEY) === "1") {
      setIsHost(true);
    }
  }, []);

  useEffect(() => {
    if (!token) { setIsHost(false); return; }
    getHostListings(token)
      .then((res) => {
        if ((res?.listings?.length ?? 0) > 0) {
          setIsHost(true);
          if (typeof window !== "undefined") window.localStorage.setItem(HOST_SEEN_KEY, "1");
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (hostMode) {
      setIsHost(true);
      if (typeof window !== "undefined") window.localStorage.setItem(HOST_SEEN_KEY, "1");
    }
  }, [hostMode]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const handleSignOut = () => {
    signOut();
    if (typeof window !== "undefined") window.localStorage.removeItem(HOST_SEEN_KEY);
    setIsHost(false);
    showToast("You've been signed out", "info");
    setDropdownOpen(false);
    setDrawerOpen(false);
    // Land somewhere public so the user never sits on a now-unauthorized page.
    router.push("/");
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-5 lg:px-8">

          {/* ── Logo ── */}
          <Link href="/" className="shrink-0 transition-opacity hover:opacity-80">
            <img src={logoSrc} alt="FreeSpace" className="h-11 w-auto" />
          </Link>

          {/* ── Right — desktop: nav links + auth grouped together ── */}
          <div className="hidden items-center gap-1 md:flex">
            {/* Contextual nav links */}
            <nav className="flex items-center gap-0.5">
              {hostMode ? (
                <>
                  <NavLink href="/host/dashboard" active={!!pathname?.startsWith("/host/dashboard")}>
                    Dashboard
                  </NavLink>
                  {user && (
                    <NavLink href="/dashboard/earnings" active={pathname === "/dashboard/earnings"}>
                      Earnings
                    </NavLink>
                  )}
                  <NavLink href="/host/start" active={pathname === "/host/start"}>
                    Add a space
                  </NavLink>
                </>
              ) : user ? (
                <>
                  <NavLink href="/" active={pathname === "/"}>
                    Find parking
                  </NavLink>
                  <NavLink href="/bookings" active={!!pathname?.startsWith("/bookings")}>
                    My bookings
                  </NavLink>
                  <NavLink href="/dashboard/favorites" active={pathname === "/dashboard/favorites"}>
                    Saved
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink href="/host" active={pathname === "/host"}>
                    Become a host
                  </NavLink>
                  <NavLink href="/support" active={pathname === "/support"}>
                    Help
                  </NavLink>
                </>
              )}
            </nav>

            {/* Host entry — driver is the default; hosting is opt-in */}
            {user && (
              hostMode ? (
                <Link
                  href="/"
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  ← Switch to parking
                </Link>
              ) : isHost ? (
                <Link
                  href="/host/dashboard"
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Switch to hosting
                </Link>
              ) : (
                <Link
                  href="/host"
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  List your space
                </Link>
              )
            )}

            {/* Divider before auth */}
            <span className="mx-1.5 h-5 w-px bg-slate-200" aria-hidden="true" />

            {/* Avatar dropdown / auth buttons */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 shadow-sm transition hover:shadow-md"
                  aria-label="Account menu"
                >
                  {/* Hamburger lines */}
                  <svg className="h-[15px] w-[15px] text-slate-500" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                    <line x1="0" y1="1" x2="18" y2="1" />
                    <line x1="0" y1="7" x2="18" y2="7" />
                    <line x1="0" y1="13" x2="18" y2="13" />
                  </svg>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">
                    {accountInitial(user.name, user.email)}
                  </span>
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      className="absolute right-0 mt-2 w-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                    >
                      {/* User info */}
                      <div className="border-b border-slate-100 px-4 py-3.5">
                        <p className="text-[14px] font-semibold text-slate-900">{user.name?.trim() || "My account"}</p>
                        <p className="text-[12px] text-slate-500">{user.email}</p>
                      </div>

                      {/* Parking */}
                      <div className="border-b border-slate-100 py-1.5">
                        <DropdownItem href="/bookings" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                          My bookings
                        </DropdownItem>
                        <DropdownItem href="/dashboard/favorites" icon={<Heart className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                          Saved spaces
                        </DropdownItem>
                      </div>

                      {/* Hosting — only for actual hosts; otherwise a single opt-in link */}
                      <div className="border-b border-slate-100 py-1.5">
                        {isHost ? (
                          <>
                            <DropdownItem href="/host/dashboard" icon={<LayoutGrid className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                              Host dashboard
                            </DropdownItem>
                            <DropdownItem href="/host/start" icon={<PlusCircle className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                              Add a space
                            </DropdownItem>
                            <DropdownItem href="/dashboard/earnings" icon={<BarChart3 className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                              Earnings
                            </DropdownItem>
                          </>
                        ) : (
                          <DropdownItem href="/host" icon={<PlusCircle className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                            List your space
                          </DropdownItem>
                        )}
                      </div>

                      {/* Account */}
                      <div className="border-b border-slate-100 py-1.5">
                        <DropdownItem href="/dashboard/personal-info" icon={<UserRound className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                          Profile
                        </DropdownItem>
                        <DropdownItem href="/dashboard/vehicle" icon={<Car className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                          Vehicle
                        </DropdownItem>
                        <DropdownItem href="/dashboard/security" icon={<Shield className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                          Security
                        </DropdownItem>
                      </div>

                      {/* Help + admin + sign out */}
                      <div className="py-1.5">
                        <DropdownItem href="/support" icon={<HelpCircle className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                          Help
                        </DropdownItem>
                        {user.role === "admin" && (
                          <DropdownItem href="/admin" icon={<Settings className="h-4 w-4" />} onClick={() => setDropdownOpen(false)}>
                            Admin
                          </DropdownItem>
                        )}
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          <span className="text-rose-400"><LogOut className="h-4 w-4" /></span>
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-brand-500 px-5 py-2 text-[13px] font-bold text-white shadow-sm transition hover:bg-brand-600"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* ── Hamburger — mobile ── */}
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50 md:hidden"
          >
            <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
              <line x1="2" y1="5" x2="16" y2="5" className="origin-center transition-all duration-300" style={{ transform: drawerOpen ? "rotate(45deg) translate(0px, 4px)" : "none", transformOrigin: "9px 5px" }} />
              <line x1="2" y1="9" x2="16" y2="9" className="transition-all duration-300" style={{ opacity: drawerOpen ? 0 : 1 }} />
              <line x1="2" y1="13" x2="16" y2="13" className="origin-center transition-all duration-300" style={{ transform: drawerOpen ? "rotate(-45deg) translate(0px, -4px)" : "none", transformOrigin: "9px 13px" }} />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Mobile backdrop ── */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 top-16 z-40 bg-black/30"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeDrawer}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer"
            className="fixed inset-0 top-16 z-50 flex flex-col bg-white shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
          >
            {/* User card */}
            {user && (
              <Link
                href="/dashboard/personal-info"
                onClick={closeDrawer}
                className="mx-5 mt-5 flex items-center gap-3.5 rounded-2xl bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[16px] font-bold text-white">
                  {accountInitial(user.name, user.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{user.name?.trim() || "My account"}</p>
                  <p className="truncate text-[12px] text-slate-500">{user.email}</p>
                </div>
              </Link>
            )}

            <nav className="flex-1 overflow-y-auto px-5 py-5">
              <DrawerSection label="Park">
                <DrawerLink href="/" onClick={closeDrawer} icon={<MapPin className="h-5 w-5" />} active={pathname === "/"}>
                  Find parking
                </DrawerLink>
                {user && (
                  <DrawerLink href="/bookings" onClick={closeDrawer} icon={<CalendarCheck className="h-5 w-5" />} active={!!pathname?.startsWith("/bookings")}>
                    My bookings
                  </DrawerLink>
                )}
                {user && (
                  <DrawerLink href="/dashboard/favorites" onClick={closeDrawer} icon={<Heart className="h-5 w-5" />} active={pathname === "/dashboard/favorites"}>
                    Saved spaces
                  </DrawerLink>
                )}
              </DrawerSection>

              <DrawerSection label="Host">
                {isHost ? (
                  <>
                    <DrawerLink href="/host/dashboard" onClick={closeDrawer} icon={<LayoutGrid className="h-5 w-5" />} active={!!pathname?.startsWith("/host/dashboard")}>
                      Host dashboard
                    </DrawerLink>
                    <DrawerLink href="/host/start" onClick={closeDrawer} icon={<PlusCircle className="h-5 w-5" />} active={pathname === "/host/start"}>
                      Add a space
                    </DrawerLink>
                    <DrawerLink href="/dashboard/earnings" onClick={closeDrawer} icon={<BarChart3 className="h-5 w-5" />} active={pathname === "/dashboard/earnings"}>
                      Earnings
                    </DrawerLink>
                  </>
                ) : (
                  <DrawerLink href="/host" onClick={closeDrawer} icon={<PlusCircle className="h-5 w-5" />} active={pathname === "/host"}>
                    List your space
                  </DrawerLink>
                )}
              </DrawerSection>

              {user && (
                <DrawerSection label="Account">
                  <DrawerLink href="/dashboard/personal-info" onClick={closeDrawer} icon={<UserRound className="h-5 w-5" />} active={pathname === "/dashboard/personal-info"}>
                    Profile
                  </DrawerLink>
                  <DrawerLink href="/dashboard/vehicle" onClick={closeDrawer} icon={<Car className="h-5 w-5" />} active={pathname === "/dashboard/vehicle"}>
                    Vehicle
                  </DrawerLink>
                  <DrawerLink href="/support" onClick={closeDrawer} icon={<HelpCircle className="h-5 w-5" />} active={pathname === "/support"}>
                    Help
                  </DrawerLink>
                  {user.role === "admin" && (
                    <DrawerLink href="/admin" onClick={closeDrawer} icon={<Settings className="h-5 w-5" />} active={!!pathname?.startsWith("/admin")}>
                      Admin
                    </DrawerLink>
                  )}
                </DrawerSection>
              )}
            </nav>

            <div
              className="border-t border-slate-100 px-5 pt-4"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            >
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                  Sign out
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/login" onClick={closeDrawer} className="flex items-center justify-center rounded-xl border border-slate-200 py-3.5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
                    Log in
                  </Link>
                  <Link href="/signup" onClick={closeDrawer} className="flex items-center justify-center rounded-xl bg-brand-500 py-3.5 text-[15px] font-semibold text-white hover:bg-brand-600">
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

// ── Sub-components ────────────────────────────────────────────────────────────

function NavLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href as any}
      className={`rounded-full px-3.5 py-2 text-[13.5px] font-semibold transition ${
        active ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}

function DropdownItem({
  href, icon, onClick, children,
}: {
  href: string;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as any}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <span className="text-slate-400">{icon}</span>
      {children}
    </Link>
  );
}

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DrawerLink({
  href, onClick, icon, active, children,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as any}
      onClick={onClick}
      className={`flex items-center gap-4 rounded-xl px-4 py-3.5 text-[16px] font-semibold transition active:bg-slate-100 ${
        active ? "bg-brand-50 text-brand-800" : "text-slate-800 hover:bg-slate-50"
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
      }`}>
        {icon}
      </span>
      {children}
    </Link>
  );
}
