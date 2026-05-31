"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "info" | "error";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast stack — bottom-centre, above everything */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const icon =
    toast.type === "success" ? (
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity={0.15} />
        <path d="M4.5 8l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : toast.type === "error" ? (
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity={0.15} />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
      </svg>
    ) : (
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="currentColor" opacity={0.15} />
        <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
      </svg>
    );

  const colours =
    toast.type === "success"
      ? "bg-[#111827] text-white"
      : toast.type === "error"
        ? "bg-rose-600 text-white"
        : "bg-[#111827] text-white";

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-semibold shadow-lg ${colours} animate-toast-in`}
      style={{ whiteSpace: "nowrap" }}
    >
      {icon}
      {toast.message}
    </div>
  );
}
