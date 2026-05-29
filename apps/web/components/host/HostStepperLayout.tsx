"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  step: number;
  totalSteps: number;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  loading?: boolean;
  error?: string | null;
};

export function HostStepperLayout({
  title,
  step,
  totalSteps,
  description,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  backDisabled,
  loading,
  error,
}: Props) {
  const progress = Math.round((step / totalSteps) * 100);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-white px-5">
      {/* ── Header ── */}
      <div className="pt-6 pb-2">
        {/* Step counter + progress */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-300">
            Step {step} of {totalSteps}
          </span>
          <span className="text-xs font-semibold text-brand-500">
            {progress}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Title */}
        <h1 className="mt-5 text-2xl font-semibold leading-snug tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {error}
        </div>
      )}

      {/* ── Step content ── */}
      <div className="flex-1 py-5">{children}</div>

      {/* ── Footer ── */}
      <div className="border-t border-slate-100 py-4 pb-10">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={backDisabled}
              className="flex h-12 shrink-0 items-center gap-1 rounded-lg px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          ) : (
            /* Spacer so the continue button stays right-aligned on step 1 */
            <div className="w-[88px] shrink-0" />
          )}

          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="flex h-12 flex-1 items-center justify-center rounded-lg bg-brand-500 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? "Saving…" : nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
