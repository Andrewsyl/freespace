"use client";

import { useEffect, useRef } from "react";

type TextVariant = "signin_with" | "signup_with" | "continue_with" | "signin";

/**
 * Renders Google's official Sign In With Google button via `google.accounts.id.renderButton`.
 *
 * This approach works in all browsers including Chrome (which uses FedCM and blocks
 * programmatic clicks on hidden cross-origin iframes). The button is rendered directly
 * by the GIS library into our container div, so FedCM treats it as a real user gesture.
 *
 * The GIS script is loaded globally by GoogleAuthProvider in the root layout.
 */
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

  // Keep callback refs stable so the useEffect doesn't re-run on every render
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);
  successRef.current = onSuccess;
  errorRef.current = onError;

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) return;

    const render = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gis = (window as any).google?.accounts?.id;
      if (!gis || !containerRef.current) return;

      // Clear any previously rendered button (e.g. on text prop change)
      containerRef.current.innerHTML = "";

      gis.initialize({
        client_id: clientId,
        callback: (response: { credential?: string }) => {
          if (response.credential) successRef.current(response.credential);
          else errorRef.current?.();
        },
      });

      gis.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text,
        // Use the container's actual width, fall back to 400 before layout settles
        width: Math.floor(containerRef.current.getBoundingClientRect().width) || 400,
        shape: "rectangular",
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.accounts?.id) {
      render();
      return;
    }

    // GIS script hasn't finished loading yet — poll until it's ready
    const timer = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.accounts?.id) {
        clearInterval(timer);
        render();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [text]); // Re-render button when the text label changes

  return <div ref={containerRef} className="w-full overflow-hidden rounded-xl" />;
}
