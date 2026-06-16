"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { LoginModal } from "./LoginModal";

type AuthModalContextValue = {
  /** Open the global login modal. Pass a path to navigate to after sign-in. */
  openLogin: (next?: string | null) => void;
  closeLogin: () => void;
  isOpen: boolean;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return ctx;
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  const openLogin = useCallback((nextPath?: string | null) => {
    setNext(nextPath ?? null);
    setIsOpen(true);
  }, []);

  const closeLogin = useCallback(() => setIsOpen(false), []);

  return (
    <AuthModalContext.Provider value={{ openLogin, closeLogin, isOpen }}>
      {children}
      <LoginModal open={isOpen} next={next} onClose={closeLogin} />
    </AuthModalContext.Provider>
  );
}
