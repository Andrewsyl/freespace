type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = (process.env.EXPO_PUBLIC_LOG_LEVEL ?? "info") as LogLevel;

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
    getSentry()?.captureException(error, {
      tags: {
        source: "global-error-handler",
        isFatal: String(Boolean(isFatal)),
      },
    });
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

function getSentry():
  | {
      captureException: (error: unknown, context?: unknown) => void;
    }
  | null {
  try {
    // Use a runtime require so Jest does not need to parse the package unless configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@sentry/react-native");
  } catch {
    return null;
  }
}

async function reportClientError(payload: {
  source: "mobile";
  name?: string;
  message: string;
  stack?: string;
  isFatal?: boolean;
}) {
  const apiBase = process.env.EXPO_PUBLIC_API_BASE;
  if (!apiBase) return;
  try {
    await fetch(`${apiBase}/api/support/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Keep crash reporting fire-and-forget.
  }
}
