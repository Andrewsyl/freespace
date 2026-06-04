"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { getHostListings } from "../lib/api";

const BASE_SECTIONS = [
  {
    heading: "Account",
    links: [
      { label: "My Bookings",    href: "/bookings" },
      { label: "Personal Info",  href: "/dashboard/personal-info" },
      { label: "Vehicle",        href: "/dashboard/vehicle" },
      { label: "Favourites",     href: "/dashboard/favorites" },
    ],
  },
  {
    heading: "Payments",
    links: [
      { label: "Payment Methods", href: "/dashboard/payments" },
      { label: "Earnings",        href: "/dashboard/earnings" },
    ],
  },
  {
    heading: "Settings",
    links: [
      { label: "Login & Security", href: "/dashboard/security" },
      { label: "Notifications",    href: "/dashboard/notifications" },
      { label: "Support",          href: "/dashboard/support" },
    ],
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { token, signOut } = useAuth();
  const pathname = usePathname();
  const [hasListings, setHasListings] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) return;
    getHostListings(token)
      .then((res) => setHasListings((res?.listings?.length ?? 0) > 0))
      .catch(() => setHasListings(false));
  }, [token]);

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* ── Left sidebar ── */}
      <aside className="hidden w-52 shrink-0 md:block">
        <div className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto border-r border-slate-200 bg-white pt-8">
          <nav className="px-4 pb-8">
            <div className="space-y-5">
              {BASE_SECTIONS.map(({ heading, links }) => (
                <div key={heading}>
                  <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                    {heading}
                  </p>
                  <ul className="space-y-0.5">
                    {links.map(({ label, href }) => {
                      const active = pathname === href || (href !== "/bookings" && pathname?.startsWith(href + "/"));
                      return (
                        <li key={href}>
                          <Link
                            href={href as any}
                            className={`block rounded-lg px-3 py-2 text-[13.5px] transition ${
                              active
                                ? "bg-slate-100 font-semibold text-slate-900"
                                : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                            }`}
                          >
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
                  <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                    Hosting
                  </p>
                  <ul className="space-y-0.5">
                    <li>
                      <Link
                        href={"/host/dashboard" as any}
                        className={`block rounded-lg px-3 py-2 text-[13.5px] transition ${
                          pathname === "/host/dashboard"
                            ? "bg-slate-100 font-semibold text-slate-900"
                            : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      >
                        Host dashboard
                      </Link>
                    </li>
                  </ul>
                </div>
              )}

              {/* Become a host CTA */}
              {hasListings === false && (
                <div>
                  <Link
                    href={"/host" as any}
                    className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3 py-3 transition hover:bg-emerald-100"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                      </svg>
                    </span>
                    <div>
                      <p className="text-[12.5px] font-bold text-emerald-800">Got a parking space?</p>
                      <p className="text-[11px] leading-snug text-emerald-600">List it and start earning</p>
                    </div>
                  </Link>
                </div>
              )}

              <div className="border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="block w-full rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-600 transition"
                >
                  Log out
                </button>
              </div>
            </div>
          </nav>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="min-w-0 flex-1 bg-slate-50">
        <div className="max-w-2xl py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
