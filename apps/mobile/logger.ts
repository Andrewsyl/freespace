import Constants from "expo-constants";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = (process.env.EXPO_PUBLIC_LOG_LEVEL ?? "info") as LogLevel;
const runtimeAppEnv =
  (Constants.expoConfig as { extra?: { appEnv?: string } } | null)?.extra?.appEnv?.trim().toLowerCase() ??
  process.env.APP_ENV?.trim().toLowerCase() ??
  (__DEV__ ? "local" : "production");

function shouldLog(level: LogLevel) {
  return levelOrder[level] >= levelOrder[currentLevel];
}

function formatMessage(level: LogLevel, message: string, data?: unknown) {
  const prefix = `[mobile:${level}]`;
  if (data === undefined) return `${prefix} ${message}`;
  try {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  } catch {
    return `${prefix} ${message}`;
  }
}

export function logDebug(message: string, data?: unknown) {
  if (!shouldLog("debug")) return;
  console.log(formatMessage("debug", message, data));
}

export function logInfo(message: string, data?: unknown) {
  if (!shouldLog("info")) return;
  console.log(formatMessage("info", message, data));
}

export function logWarn(message: string, data?: unknown) {
  if (!shouldLog("warn")) return;
  console.warn(formatMessage("warn", message, data));
}

export function logError(message: string, data?: unknown) {
  if (!shouldLog("error")) return;
  console.error(formatMessage("error", message, data));
}

export function installGlobalErrorLogging() {
  const globalErrorUtils = (globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
      setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;

  if (!globalErrorUtils?.setGlobalHandler) return;

  const existingHandler = globalErrorUtils.getGlobalHandler?.();
  globalErrorUtils.setGlobalHandler((error, isFatal) => {
    const { capturePostHogException } = require("./posthog") as typeof import("./posthog");
    capturePostHogException(error, { source: "global-error-handler", isFatal: String(Boolean(isFatal)) });
    logError("Unhandled JS error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      isFatal: Boolean(isFatal),
    });
    void reportClientError({
      source: "mobile",
      name: error?.name,
      message: error?.message ?? "Unknown mobile error",
      stack: error?.stack,
      isFatal: Boolean(isFatal),
    });
    existingHandler?.(error, isFatal);
  });
}

async function reportClientError(payload: {
  source: "mobile";
  name?: string;
  message: string;
  stack?: string;
  isFatal?: boolean;
}) {
  if (__DEV__ || runtimeAppEnv !== "production") return;
  const apiBase = process.env.EXPO_PUBLIC_API_BASE;
  if (!apiBase) return;
  try {
    await fetch(`${apiBase}/api/support/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        appEnv: runtimeAppEnv,
        runtimeUrl: apiBase,
      }),
    });
  } catch {
    // Keep crash reporting fire-and-forget.
  }
}
