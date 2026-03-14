"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") {
      router.replace("/");
    }
  }, [user, router]);

  if (!user || user.role !== "admin") {
    return <div className="p-6 text-sm text-slate-600">Checking admin access…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <img src="/freespace-logo.png" alt="FreeSpace" className="h-7 w-auto" />
              <span>Admin</span>
            </Link>
            <nav className="hidden items-center gap-4 text-sm font-semibold text-slate-600 md:flex">
              <Link href="/search" className="hover:text-slate-900">Search</Link>
              <Link href="/admin/dashboard" className="hover:text-slate-900">Dashboard</Link>
              <Link href="/admin/listings" className="hover:text-slate-900">Listings</Link>
              <Link href="/admin/bookings" className="hover:text-slate-900">Bookings</Link>
              <Link href="/admin/support" className="hover:text-slate-900">Support</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 md:inline">{user.email}</span>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.replace("/login");
              }}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[240px,1fr]">
        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500">Admin</p>
            <p className="text-sm font-semibold text-slate-900">Platform controls</p>
          </div>
          <nav className="space-y-2 text-sm font-semibold text-slate-700">
            <Link href="/admin/dashboard" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
              Dashboard
            </Link>
            <Link href="/admin/users" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
              Users
            </Link>
            <Link href="/admin/listings" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
              Listings
            </Link>
            <Link href="/admin/bookings" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
              Bookings
            </Link>
            <Link href="/admin/payments" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
              Payments
            </Link>
            <Link href="/admin/payouts" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
              Payouts
            </Link>
            <Link href="/admin/support" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
              Support
            </Link>
            <Link href="/admin/settings" className="block rounded-lg px-3 py-2 hover:bg-slate-100">
              Settings
            </Link>
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}
