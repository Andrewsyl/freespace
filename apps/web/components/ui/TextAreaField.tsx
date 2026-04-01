import clsx from "clsx";
import type { ReactNode, TextareaHTMLAttributes } from "react";

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  textareaClassName?: string;
  wrapperClassName?: string;
};

export function TextAreaField({ label, hint, error, className, textareaClassName, wrapperClassName, id, ...props }: TextAreaFieldProps) {
  const fieldId = id ?? props.name;
  return (
    <label className={clsx("flex flex-col gap-1 text-sm font-medium text-slate-700", wrapperClassName)} htmlFor={fieldId}>
      {label ? <span>{label}</span> : null}
      <textarea
        id={fieldId}
        {...props}
        className={clsx(
          "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none",
          error && "border-rose-300 focus:border-rose-400",
          textareaClassName,
          className
        )}
      />
      {error ? <span className="text-xs text-rose-700">{error}</span> : hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
