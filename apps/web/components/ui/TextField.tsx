 "use client";

import clsx from "clsx";
import { useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  inputClassName?: string;
  wrapperClassName?: string;
  clearable?: boolean;
};

export function TextField({
  label,
  hint,
  error,
  className,
  inputClassName,
  wrapperClassName,
  id,
  clearable = true,
  onChange,
  ...props
}: TextFieldProps) {
  const fieldId = id ?? props.name;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const value = typeof props.value === "string" ? props.value : typeof props.defaultValue === "string" ? props.defaultValue : "";
  const canClear = clearable && isFocused && !!value && props.disabled !== true && props.readOnly !== true;

  const clearField = () => {
    const element = inputRef.current;
    if (!element) return;
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(element, "");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.focus();
  };

  return (
    <label className={clsx("flex flex-col gap-1 text-sm font-medium text-slate-700", wrapperClassName)} htmlFor={fieldId}>
      {label ? <span>{label}</span> : null}
      <span className="relative block">
        <input
          id={fieldId}
          ref={inputRef}
          {...props}
          onChange={onChange}
          onFocus={(event) => {
            setIsFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            props.onBlur?.(event);
          }}
          className={clsx(
            "h-11 w-full rounded-lg border border-slate-200 px-3 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none",
            canClear && "pr-10",
            error && "border-rose-300 focus:border-rose-400",
            inputClassName,
            className
          )}
        />
        {canClear ? (
          <button
            aria-label="Clear input"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={clearField}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        ) : null}
      </span>
      {error ? <span className="text-xs text-rose-700">{error}</span> : hint ? <span className="text-xs text-slate-600">{hint}</span> : null}
    </label>
  );
}
