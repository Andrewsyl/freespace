"use client";

import type { ReactNode } from "react";

/* ── Shared premium primitives for the host wizard steps ──────────────────────── */

/** Clear, human section title that opens each section. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[17px] font-bold tracking-[-0.01em] text-slate-900">
      {children}
    </h2>
  );
}

/** Section title + optional helper sentence — the standard section intro. */
export function SectionIntro({
  label,
  children,
  className = "",
}: {
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-5 ${className}`}>
      <SectionLabel>{label}</SectionLabel>
      {children && <p className="mt-1 text-[14px] leading-relaxed text-slate-500">{children}</p>}
    </div>
  );
}

/** Single-select tile with a radio indicator. Flat, 2px border signals state. */
export function RadioTile({
  active,
  onClick,
  title,
  description,
  trailing,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        active
          ? "border-brand-600 bg-brand-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-semibold text-slate-900">{title}</p>
          {trailing}
        </div>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{description}</p>}
      </div>
      <RadioDot active={active} />
    </button>
  );
}

export function RadioDot({ active }: { active: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        active ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-white"
      }`}
    >
      {active && <span className="h-2 w-2 rounded-full bg-white" />}
    </span>
  );
}

/** Multi-select pill chip with an icon. Flat, border signals state. */
export function ChipToggle({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
        active
          ? "border-brand-600 bg-brand-50 text-brand-800"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      {icon && <span className={active ? "text-brand-600" : "text-slate-400"}>{icon}</span>}
      {children}
    </button>
  );
}

/** Soft brand-tinted information callout. */
export function TipCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
      <p className="text-[13.5px] font-semibold text-brand-900">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-brand-700">{children}</p>
    </div>
  );
}
