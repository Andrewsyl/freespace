"use client";

import { useEffect } from "react";
import { reportClientError } from "../lib/telemetry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientError({
      name: error.name,
      message: error.message,
      stack: error.stack,
      isFatal: true,
    });
  }, [error]);

  return (
    <html>
      <body className="bg-slate-50 text-slate-900">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Something went wrong</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">We hit an unexpected error</h1>
          <p className="mt-3 text-sm text-slate-600">
            The issue has been reported. Try again, or refresh the page if the problem continues.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
