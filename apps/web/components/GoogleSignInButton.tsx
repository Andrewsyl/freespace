"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

type TextVariant = "signin_with" | "signup_with" | "continue_with" | "signin";

type GoogleIdClient = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    use_fedcm_for_button?: boolean;
  }) => void;
  renderButton: (element: HTMLElement, options: object) => void;
};

type GoogleWindow = Window & {
  google?: { accounts?: { id?: GoogleIdClient } };
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
  const containerRef = useRef<HTMLDivElement>(null);
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);
  successRef.current = onSuccess;
  errorRef.current = onError;

  const render = () => {
    const gis = (window as GoogleWindow).google?.accounts?.id;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    if (!gis || !containerRef.current || !clientId) return false;

    gis.initialize({
      client_id: clientId,
      // Opt out of FedCM for the button — use the standard OAuth popup instead.
      // FedCM is unreliable in private mode, with ad blockers, and when the
      // browser has no active Google session.
      use_fedcm_for_button: false,
      callback: (response) => {
        if (response.credential) successRef.current(response.credential);
        else errorRef.current?.();
      },
    });

    const width = Math.floor(containerRef.current.getBoundingClientRect().width) || 360;
    containerRef.current.innerHTML = "";
    gis.renderButton(containerRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text,
      width,
      shape: "rectangular",
    });
    return true;
  };

  // Render immediately if GIS script is already in the page (hot reload, re-mount).
  useEffect(() => {
    if (!render()) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={render}
      />
      {/* GIS renders its own bordered button inside; no wrapper chrome (avoids
          a double border + white flanks when the column is wider than GIS's
          ~400px cap). Constrain width via the parent. */}
      <div
        ref={containerRef}
        className="flex min-h-[40px] w-full items-center justify-center overflow-hidden"
      />
    </>
  );
}
