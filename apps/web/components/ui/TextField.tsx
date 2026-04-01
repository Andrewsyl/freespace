import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  inputClassName?: string;
  wrapperClassName?: string;
};

export function TextField({ label, hint, error, className, inputClassName, wrapperClassName, id, ...props }: TextFieldProps) {
  const fieldId = id ?? props.name;
  return (
    <label className={clsx("flex flex-col gap-1 text-sm font-medium text-slate-700", wrapperClassName)} htmlFor={fieldId}>
      {label ? <span>{label}</span> : null}
      <input
        id={fieldId}
        {...props}
        className={clsx(
          "h-11 rounded-xl border border-slate-200 px-3 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none",
          error && "border-rose-300 focus:border-rose-400",
          inputClassName,
          className
        )}
      />
      {error ? <span className="text-xs text-rose-700">{error}</span> : hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
