"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { getHostListings } from "../lib/api";
import {
  BookOpen, CreditCard, TrendingUp, Heart, Lock, Bell, HelpCircle, LogOut,
  Home, ChevronRight, LayoutGrid, UserRound,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    heading: "Account",
    links: [
      { label: "My Bookings",    sub: "View and manage trips",     href: "/bookings",                  icon: BookOpen   },
      { label: "Personal Info",  sub: "Name, email and phone",     href: "/dashboard/personal-info",   icon: UserRound  },
      { label: "Vehicle",        sub: "Car details and plate",     href: "/dashboard/vehicle",         icon: null       },
      { label: "Favourites",     sub: "Saved spaces",              href: "/dashboard/favorites",       icon: Heart      },
    ],
  },
  {
    heading: "Payments",
    links: [
      { label: "Payment Methods", sub: "Cards and billing",   href: "/dashboard/payments",  icon: CreditCard },
      { label: "Earnings",        sub: "Host payouts",         href: "/dashboard/earnings",  icon: TrendingUp },
    ],
  },
  {
    heading: "Settings",
    links: [
      { label: "Login & Security", sub: "Password and devices",   href: "/dashboard/security",      icon: Lock       },
      { label: "Notifications",    sub: "Alerts and updates",     href: "/dashboard/notifications", icon: Bell       },
      { label: "Support",          sub: "Get help",               href: "/dashboard/support",       icon: HelpCircle },
    ],
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, token, signOut } = useAuth();
  const pathname = usePathname();
  const [hasListings, setHasListings] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) return;
    getHostListings(token)
      .then((res) => setHasListings((res?.listings?.length ?? 0) > 0))
      .catch(() => setHasListings(false));
  }, [token]);

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase()
    || user?.email?.charAt(0)?.toUpperCase()
    || "?";
  const inHostArea = pathname?.startsWith("/host") || pathname === "/dashboard/earnings";
  const hostHref = hasListings ? "/host/dashboard" : "/host";

  return (
    <div className="flex min-h-[calc(100vh-64px)]">

      {/* ── Left sidebar ── */}
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-16 flex h-[calc(100vh-64px)] flex-col overflow-y-auto border-r border-slate-200 bg-white">

          {/* Profile card */}
          <Link
            href="/dashboard/personal-info"
            className="group flex items-center gap-3 border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[15px] font-bold text-brand-600">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-slate-900">
                {user?.name?.trim() || "Your account"}
              </p>
              <p className="truncate text-[11.5px] text-slate-500">{user?.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {user?.emailVerified && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                  Verified
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-slate-500" strokeWidth={2.5} />
            </div>
          </Link>

          <div className="border-b border-slate-100 px-3 py-3">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <Link
                href="/dashboard"
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold transition ${
                  !inHostArea ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" strokeWidth={2.2} />
                Driver
              </Link>
              <Link
                href={hostHref as any}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold transition ${
                  inHostArea ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Home className="h-3.5 w-3.5" strokeWidth={2.2} />
                Host
              </Link>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-5">
              {NAV_SECTIONS.map(({ heading, links }) => (
                <div key={heading}>
                  <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {heading}
                  </p>
                  <ul className="space-y-0.5">
                    {links.map(({ label, href, icon: Icon }) => {
                      const active = pathname === href || (href !== "/bookings" && pathname?.startsWith(href + "/"));
                      return (
                        <li key={href}>
                          <Link
                            href={href as any}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
                              active
                                ? "bg-brand-50 font-semibold text-brand-700"
                                : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            {Icon && <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand-500" : "text-slate-400"}`} strokeWidth={2} />}
                            {label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {/* Hosting — conditional */}
              {hasListings === true && (
                <div>
                  <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Hosting
                  </p>
                  <ul className="space-y-0.5">
                    <li>
                      <Link
                        href={"/host/dashboard" as any}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
                          pathname === "/host/dashboard"
                            ? "bg-brand-50 font-semibold text-brand-700"
                            : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <LayoutGrid className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                        Host dashboard
                      </Link>
                    </li>
                  </ul>
                </div>
              )}

              {/* Become a host CTA */}
              {hasListings === false && (
                <Link
                  href={"/host" as any}
                  className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50 px-3 py-3 transition hover:bg-brand-100"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                    <Home className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  <div>
                    <p className="text-[12.5px] font-bold text-brand-800">Got a parking space?</p>
                    <p className="text-[11px] leading-snug text-brand-600">List it and start earning</p>
                  </div>
                </Link>
              )}
            </div>
          </nav>

          {/* Sign out */}
          <div className="border-t border-slate-100 px-3 py-3">
            <button
              type="button"
              onClick={() => signOut()}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="min-w-0 flex-1 bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
