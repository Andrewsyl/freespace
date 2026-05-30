"use client";

import { useEffect, useRef, useState } from "react";

type TextVariant = "signin_with" | "signup_with" | "continue_with" | "signin";

type GoogleIdClient = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }) => void;
  renderButton: (element: HTMLElement, options: object) => void;
  prompt: (callback?: (notification: {
    isNotDisplayed: () => boolean;
    isSkippedMoment: () => boolean;
  }) => void) => void;
};

type GoogleWindow = Window & {
  google?: { accounts?: { id?: GoogleIdClient } };
};

const LABEL: Record<TextVariant, string> = {
  signin_with: "Sign in with Google",
  signup_with: "Sign up with Google",
  continue_with: "Continue with Google",
  signin: "Sign in",
};

export function GoogleSignInButton({
  onSuccess,
  onError,
  text = "continue_with",
}: {
  onSuccess: (credential: string) => void;
  onError?: () => void;
  text?: TextVariant;
}) {
  const fallbackRef = useRef<HTMLDivElement>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [busy, setBusy] = useState(false);

  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);
  successRef.current = onSuccess;
  errorRef.current = onError;

  const getGis = () => (window as GoogleWindow).google?.accounts?.id;

  const initGis = (gis: GoogleIdClient) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) return;
    gis.initialize({
      client_id: clientId,
      callback: (response: { credential?: string }) => {
        setBusy(false);
        if (response.credential) successRef.current(response.credential);
        else errorRef.current?.();
      },
    });
  };

  // Render the fallback GIS button when One Tap is unavailable
  useEffect(() => {
    if (!showFallback || !fallbackRef.current) return;
    const gis = getGis();
    if (!gis) return;
    initGis(gis);
    fallbackRef.current.innerHTML = "";
    gis.renderButton(fallbackRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text,
      width: Math.floor(fallbackRef.current.getBoundingClientRect().width) || 360,
      shape: "pill",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFallback, text]);

  const handleClick = () => {
    if (busy) return;
    const gis = getGis();
    if (!gis) { errorRef.current?.(); return; }
    setBusy(true);
    initGis(gis);
    gis.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap unavailable — surface the standard GIS button as fallback
        setBusy(false);
        setShowFallback(true);
      }
    });
  };

  if (showFallback) {
    return (
      <div
        ref={fallbackRef}
        className="flex h-12 w-full items-center justify-center overflow-hidden rounded-full"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full bg-brand-500 px-5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-brand-600 active:bg-brand-700 disabled:opacity-60"
    >
      {/* Google G logo — white */}
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path fill="white" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z" />
        <path fill="white" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
        <path fill="white" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
        <path fill="white" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
      </svg>
      {busy ? "Connecting…" : LABEL[text]}
    </button>
  );
}
