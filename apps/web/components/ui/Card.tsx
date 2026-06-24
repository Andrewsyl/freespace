import { clsx } from "clsx";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Remove the default padding — use when you need full-bleed sections inside */
  noPad?: boolean;
  /** Adds a subtle top-colour bar */
  accent?: "brand" | "amber" | "rose";
}

export function Card({ children, className, noPad, accent }: CardProps) {
  return (
    <div className={clsx(
      "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
      className,
    )}>
      {accent && (
        <div className={clsx("h-[3px] w-full", {
          "bg-brand-500": accent === "brand",
          "bg-amber-400": accent === "amber",
          "bg-rose-400":  accent === "rose",
        })} />
      )}
      {noPad ? children : <div className="px-6 py-5">{children}</div>}
    </div>
  );
}

export function CardSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("border-t border-slate-100 px-6 py-5 first:border-t-0", className)}>
      {children}
    </div>
  );
}
