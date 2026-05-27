type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: "api";
} & Record<string, unknown>;

function write(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "api",
    ...(data ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logInfo(message: string, data?: Record<string, unknown>) {
  write("info", message, data);
}

export function logWarn(message: string, data?: Record<string, unknown>) {
  write("warn", message, data);
}

export function logError(message: string, data?: Record<string, unknown>) {
  write("error", message, data);
}
