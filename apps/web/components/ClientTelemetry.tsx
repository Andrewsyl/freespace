"use client";

import { useEffect } from "react";
import { reportClientError } from "../lib/telemetry";

export function ClientTelemetry() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      void reportClientError({
        name: event.error?.name ?? "WindowError",
        message: event.error?.message ?? event.message ?? "Unknown web error",
        stack: event.error?.stack,
        isFatal: true,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason
          : new Error(typeof event.reason === "string" ? event.reason : "Unhandled rejection");
      void reportClientError({
        name: reason.name,
        message: reason.message,
        stack: reason.stack,
        isFatal: false,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
