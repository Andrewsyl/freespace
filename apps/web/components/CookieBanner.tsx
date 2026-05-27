"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE_CONSENT_KEY = "freespace_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
      setVisible(!stored);
    } catch {
      setVisible(true);
    }
  }, []);

  const saveChoice = (value: "accepted" | "rejected") => {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
    } catch {
      // ignore storage failures
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-slate-900">Cookie preferences</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            FreeSpace uses necessary cookies for login, booking, and security. We only use optional
            analytics or preference cookies where permitted. Read the{" "}
            <Link href="/legal/cookie-policy" className="font-semibold text-emerald-700 hover:text-emerald-800">
              cookie policy
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:min-w-[220px]">
          <button
            type="button"
            onClick={() => saveChoice("accepted")}
            className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Accept cookies
          </button>
          <button
            type="button"
            onClick={() => saveChoice("rejected")}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Necessary only
          </button>
        </div>
      </div>
    </div>
  );
}
