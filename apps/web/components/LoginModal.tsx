"use client";

import { useEffect, useState } from "react";
import { type Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { LoginForm } from "./LoginForm";

const ANIM_MS = 300;

/**
 * Bottom-sheet wrapper around the shared LoginForm. Rendered once at the root by
 * AuthModalProvider. The card slides up from the bottom on open and back down on
 * close (full-width sheet on mobile, centered card on desktop). On success it
 * follows `next` if one was supplied, otherwise it refreshes the current route in
 * place so client-gated content re-renders for the now-signed-in user.
 */
export function LoginModal({
  open,
  next,
  onClose,
}: {
  open: boolean;
  next: string | null;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // `rendered` keeps the sheet in the tree through the slide-down exit;
  // `visible` drives the enter/exit transform + backdrop fade.
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      // Flip to visible on the next frame so the transform animates in.
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const timer = setTimeout(() => setRendered(false), ANIM_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Close when the route changes (e.g. a footer link was followed).
  useEffect(() => {
    if (open) onClose();
    // Only react to pathname changes, not to open/onClose identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ESC to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!rendered) return null;

  const handleSuccess = () => {
    if (next) router.push(next as Route);
    else router.refresh();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl transition-transform duration-300 ease-out sm:px-8 ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Grab handle (bottom-sheet affordance) */}
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <LoginForm onSuccess={handleSuccess} onNavigate={onClose} />
      </div>
    </div>
  );
}
