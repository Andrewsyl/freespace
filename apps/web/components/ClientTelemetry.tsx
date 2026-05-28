"use client";

import { useEffect } from "react";
import { reportClientError } from "../lib/telemetry";

const CHUNK_RELOAD_KEY = "fs_chunk_reload_once";

function isChunkLoadLikeError(name?: string, message?: string, stack?: string) {
  const haystack = `${name ?? ""} ${message ?? ""} ${stack ?? ""}`.toLowerCase();
  return (
    haystack.includes("chunkloaderror") ||
    haystack.includes("loading chunk") ||
    haystack.includes("css chunk")
  );
}

function reloadOnceForChunkMismatch() {
  try {
    if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export function ClientTelemetry() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const name = event.error?.name ?? "WindowError";
      const message = event.error?.message ?? event.message ?? "Unknown web error";
      const stack = event.error?.stack;
      if (isChunkLoadLikeError(name, message, stack) && reloadOnceForChunkMismatch()) {
        return;
      }
      void reportClientError({
        name,
        message,
        stack,
        isFatal: true,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason
          : new Error(typeof event.reason === "string" ? event.reason : "Unhandled rejection");
      if (isChunkLoadLikeError(reason.name, reason.message, reason.stack) && reloadOnceForChunkMismatch()) {
        return;
      }
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
