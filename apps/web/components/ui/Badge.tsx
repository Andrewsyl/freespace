import { clsx } from "clsx";
import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "neutral" | "info" | "live";

const TONE: Record<Tone, string> = {
  success: "bg-brand-50 text-brand-700 ring-1 ring-brand-200/60",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  danger:  "bg-rose-50  text-rose-600  ring-1 ring-rose-200/60",
  neutral: "bg-slate-100 text-slate-600",
  info:    "bg-blue-50  text-blue-700  ring-1 ring-blue-200/60",
  live:    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
};

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", dot, className, children }: BadgeProps) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
      TONE[tone],
      className,
    )}>
      {dot && tone === "live" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      )}
      {dot && tone !== "live" && (
        <span className={clsx("h-1.5 w-1.5 rounded-full", {
          "bg-brand-500": tone === "success",
          "bg-amber-400": tone === "warning",
          "bg-rose-500":  tone === "danger",
          "bg-slate-400": tone === "neutral",
          "bg-blue-500":  tone === "info",
        })} />
      )}
      {children}
    </span>
  );
}
