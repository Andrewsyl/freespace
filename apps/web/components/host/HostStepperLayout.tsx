"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

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
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-white">
      {/* ── Header ── */}
      <div className="border-b border-slate-200 px-5 pb-5 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Step {step} of {totalSteps}
          </span>
          <span className="text-[11px] font-semibold text-brand-500">{progress}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <h1 className="mt-5 text-[22px] font-bold tracking-[-0.03em] text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 text-[14px] leading-relaxed text-slate-500">{description}</p>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-5 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          {error}
        </div>
      )}

      {/* ── Step content ── */}
      <div className="flex-1 px-5 py-6 pb-28">{children}</div>

      {/* ── Footer ── */}
      <div
        className="sticky bottom-0 bg-white px-5 shadow-[0_-4px_20px_rgba(15,23,42,0.08)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)", paddingTop: "12px" }}
      >
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={backDisabled}
              className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 px-4 text-[14px] font-semibold text-slate-700 transition active:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
              Back
            </button>
          ) : (
            <div className="w-[88px] shrink-0" />
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-bold text-white shadow-sm transition active:bg-brand-600 disabled:opacity-50"
          >
            {loading ? "Saving…" : nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
