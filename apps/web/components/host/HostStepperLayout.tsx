"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { Check, ShieldCheck, Lock, BadgePercent } from "lucide-react";

type FooterAction = { label: string; onClick: () => void };

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
  /** Optional secondary footer button, e.g. "Skip for now". */
  secondaryAction?: FooterAction;
  /** Full list of step titles, used to build the journey overview. */
  stepTitles?: string[];
};

/* The 8 steps grouped into three honest phases (1-indexed step numbers). */
const PHASES = [
  { name: "Your location", steps: [1, 2], caption: "Where drivers will park" },
  { name: "About the space", steps: [3, 4, 5, 6], caption: "Details, access & price" },
  { name: "Go live", steps: [7, 8], caption: "Photos & publish" },
];

const TRUST = [
  { Icon: ShieldCheck,  label: "Host protection on every booking" },
  { Icon: Lock,         label: "Secure, automatic payouts" },
  { Icon: BadgePercent, label: "Free to list — we earn only when you do" },
];

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
  secondaryAction,
  stepTitles,
}: Props) {
  const progress = Math.round((step / totalSteps) * 100);
  const activePhase = PHASES.findIndex((p) => p.steps.includes(step));

  return (
    <div className="flex h-[100dvh] flex-col bg-white">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white">
        <div className="grid h-16 grid-cols-3 items-center px-5 lg:px-8">
          <Link href="/" className="rounded-md transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
            <img src="/freespace-logo-grid-black.png" alt="FreeSpace" className="h-8 w-auto" />
          </Link>

          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="text-center text-[13px] font-semibold text-slate-400"
            >
              Step {step} of {totalSteps}
            </motion.p>
          </AnimatePresence>

          <div className="flex justify-end">
            <Link
              href="/host/dashboard"
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Save &amp; exit
            </Link>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-slate-100">
          <motion.div
            className="h-full rounded-r-full bg-brand-500"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(340px,2fr)_3fr]">

        {/* ── Left: warm journey + trust panel — desktop only ── */}
        <aside className="relative hidden flex-col justify-between border-r border-brand-100 bg-gradient-to-b from-[#f4faf6] to-[#eef7f1] lg:flex lg:px-12 lg:py-12">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand-700">List your space</p>
            <h2 className="mt-3 max-w-[16ch] text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-slate-900">
              A few quick steps to start earning.
            </h2>

            {/* Journey overview */}
            <ol className="mt-10 space-y-7">
              {PHASES.map((phase, i) => {
                const done = phase.steps[phase.steps.length - 1] < step;
                const active = i === activePhase;
                return (
                  <li key={phase.name} className="flex gap-3.5">
                    {/* Indicator */}
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
                          done
                            ? "bg-brand-600 text-white"
                            : active
                            ? "border-2 border-brand-600 bg-white text-brand-700"
                            : "border-2 border-slate-300 bg-white text-slate-400"
                        }`}
                      >
                        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      {i < PHASES.length - 1 && (
                        <span className={`mt-1.5 w-0.5 flex-1 rounded-full ${done ? "bg-brand-300" : "bg-slate-200"}`} style={{ minHeight: 18 }} />
                      )}
                    </div>

                    {/* Text */}
                    <div className="pb-1">
                      <p className={`text-[15px] font-bold ${active ? "text-slate-900" : done ? "text-slate-600" : "text-slate-400"}`}>
                        {phase.name}
                      </p>
                      {active && stepTitles ? (
                        <ul className="mt-2 space-y-1.5">
                          {phase.steps.map((s) => (
                            <li
                              key={s}
                              className={`text-[13px] ${s === step ? "font-semibold text-brand-700" : s < step ? "text-slate-400 line-through decoration-slate-300" : "text-slate-400"}`}
                            >
                              {stepTitles[s - 1]}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-0.5 text-[13px] text-slate-400">{phase.caption}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Trust block */}
          <ul className="space-y-3 border-t border-brand-100 pt-6">
            {TRUST.map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-[13px] font-medium text-slate-600">
                <Icon className="h-[18px] w-[18px] shrink-0 text-brand-600" strokeWidth={2} />
                {label}
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Right: form column ── */}
        <div className="flex min-h-0 flex-1 flex-col">

          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            <div className="mx-auto w-full max-w-[800px] px-5 pb-12 pt-10 lg:px-12 lg:pb-16 lg:pt-16">
              {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  {error}
                </div>
              )}

              {/* Heading */}
              <div className="mb-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.025em] text-slate-900 lg:text-[36px]">
                      {title}
                    </h1>
                    {description && (
                      <p className="mt-3 max-w-[46ch] text-[16px] leading-relaxed text-slate-500">{description}</p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Step body */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, delay: 0.04 }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            className="border-t border-slate-100 bg-white"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Mobile */}
            <div className="px-5 py-4 lg:hidden">
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onNext}
                  disabled={nextDisabled || loading}
                  className="flex h-14 w-full items-center justify-center rounded-xl bg-brand-600 text-[15px] font-bold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-40"
                >
                  {loading ? <Spinner label="Publishing…" /> : nextLabel}
                </button>
                {secondaryAction && (
                  <button
                    type="button"
                    onClick={secondaryAction.onClick}
                    className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {secondaryAction.label}
                  </button>
                )}
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    disabled={backDisabled}
                    className="flex h-10 items-center justify-center text-[13px] font-semibold text-slate-500 transition hover:text-slate-800 disabled:opacity-40"
                  >
                    Go back
                  </button>
                )}
              </div>
              <p className="mt-3 text-center text-[12px] text-slate-400">
                Free to list · You can edit anything later
              </p>
            </div>

            {/* Desktop */}
            <div className="hidden items-center justify-between px-12 py-5 lg:flex">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  disabled={backDisabled}
                  className="rounded-md text-[14px] font-semibold text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40"
                >
                  Go back
                </button>
              ) : <span />}

              <div className="flex items-center gap-3">
                {secondaryAction && (
                  <button
                    type="button"
                    onClick={secondaryAction.onClick}
                    className="h-12 rounded-xl border border-slate-200 px-6 text-[14px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {secondaryAction.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNext}
                  disabled={nextDisabled || loading}
                  className="h-12 min-w-[150px] rounded-xl bg-brand-600 px-7 text-[15px] font-bold text-white shadow-sm transition hover:bg-brand-700 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-40"
                >
                  {loading ? <Spinner label="Publishing…" /> : nextLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      {label}
    </span>
  );
}
