import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "./Toast";

type ToastVariant = "success" | "info" | "danger";

type ToastState = {
  id: number;
  visible: boolean;
  message: string;
  variant: ToastVariant;
};

type ShowToastOptions = {
  durationMs?: number;
  variant?: ToastVariant;
};

type GlobalToastApi = {
  show: (message: string, options?: ShowToastOptions) => void;
  showError: (message: string, options?: Omit<ShowToastOptions, "variant">) => void;
  showSuccess: (message: string, options?: Omit<ShowToastOptions, "variant">) => void;
  hide: () => void;
};

const noop = () => undefined;

const GlobalToastContext = createContext<GlobalToastApi>({
  show: noop,
  showError: noop,
  showSuccess: noop,
  hide: noop,
});

const DEFAULT_DURATION_MS = 4200;

export function GlobalToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ToastState>({
    id: 0,
    visible: false,
    message: "",
    variant: "info",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const show = useCallback(
    (message: string, options?: ShowToastOptions) => {
      if (!message.trim()) return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setState((prev) => ({
        id: prev.id + 1,
        visible: true,
        message: message.trim(),
        variant: options?.variant ?? "info",
      }));
      timerRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, visible: false }));
        timerRef.current = null;
      }, options?.durationMs ?? DEFAULT_DURATION_MS);
    },
    []
  );

  const showError = useCallback(
    (message: string, options?: Omit<ShowToastOptions, "variant">) => {
      show(message, { ...options, variant: "danger" });
    },
    [show]
  );

  const showSuccess = useCallback(
    (message: string, options?: Omit<ShowToastOptions, "variant">) => {
      show(message, { ...options, variant: "success" });
    },
    [show]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const value = useMemo<GlobalToastApi>(
    () => ({ show, showError, showSuccess, hide }),
    [hide, show, showError, showSuccess]
  );

  return (
    <GlobalToastContext.Provider value={value}>
      {children}
      <Toast
        message={state.message}
        variant={state.variant}
        visible={state.visible}
        onDismiss={hide}
        toastKey={state.id}
      />
    </GlobalToastContext.Provider>
  );
}

export function useGlobalToast() {
  return useContext(GlobalToastContext);
}

export function useToastOnMessage(
  message: string | null | undefined,
  options?: ShowToastOptions
) {
  const { show } = useGlobalToast();
  const durationMs = options?.durationMs;
  const variant = options?.variant;

  useEffect(() => {
    if (!message) return;
    show(message, { durationMs, variant });
  }, [durationMs, message, show, variant]);
}
