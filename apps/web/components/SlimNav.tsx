"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function SlimNav() {
  const { user, signOut } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <Link href="/" className="flex items-center gap-3">
        <img src="/freespace-logo.png" alt="FreeSpace" className="h-7 w-auto" />
        <span className="text-sm font-semibold text-slate-800">FreeSpace</span>
      </Link>
      <nav className="flex items-center gap-4 text-sm font-semibold text-slate-600">
        <Link href="/search" className="hover:text-slate-900">Find parking</Link>
        <Link href="/host" className="hover:text-slate-900">List a space</Link>
        <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
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
    </header>
  );
}
