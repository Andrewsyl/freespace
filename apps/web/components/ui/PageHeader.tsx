import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand-500">{eyebrow}</p>
        )}
        <h1 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1.5 text-[14px] leading-[1.6] text-slate-600">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
