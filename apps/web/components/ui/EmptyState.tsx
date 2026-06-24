import type { ReactNode } from "react";
import { clsx } from "clsx";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx(
      "flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm",
      className,
    )}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-bold text-slate-900">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
