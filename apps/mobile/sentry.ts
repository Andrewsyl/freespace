import * as Sentry from "@sentry/react-native";
import { mobileEnv } from "./env";

let _initialized = false;

// Initialise crash + error reporting. No-ops when EXPO_PUBLIC_SENTRY_DSN is
// unset (e.g. local/dev) so the app never depends on Sentry being configured.
export function initSentry() {
  if (_initialized) return;
  if (!mobileEnv.sentryDsn) return;
  Sentry.init({
    dsn: mobileEnv.sentryDsn,
    environment: mobileEnv.appEnv,
    // Keep performance tracing light in production; bump locally when profiling.
    tracesSampleRate: mobileEnv.appEnv === "production" ? 0.1 : 1.0,
    // The JS ErrorBoundary + global handler already forward errors, so avoid
    // double-reporting from Sentry's own auto-wrapping where it overlaps.
    enableNativeCrashHandling: true,
  });
  _initialized = true;
}

export function isSentryEnabled() {
  return _initialized;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!_initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

// Wrap the root component so it gets Sentry's touch/navigation instrumentation
// when a DSN is present. Without a DSN we return the component untouched so the
// app never depends on Sentry's native module being linked/initialised.
export function wrapWithSentry<C>(component: C): C {
  if (!mobileEnv.sentryDsn) return component;
  return Sentry.wrap(component as any) as C;
}
