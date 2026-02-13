"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
};

type ToastContextValue = {
  toasts: Toast[];
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_TTL_MS = 5_000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timeoutRefs.current.get(id);
    if (t) clearTimeout(t);
    timeoutRefs.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const add = useCallback(
    (type: ToastType, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const createdAt = Date.now();
      setToasts((prev) => [...prev, { id, type, message, createdAt }]);

      const t = setTimeout(() => {
        timeoutRefs.current.delete(id);
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, TOAST_TTL_MS);
      timeoutRefs.current.set(id, t);
    },
    []
  );

  const success = useCallback((message: string) => add("success", message), [add]);
  const error = useCallback((message: string) => add("error", message), [add]);
  const info = useCallback((message: string) => add("info", message), [add]);

  const value: ToastContextValue = {
    toasts,
    success,
    error,
    info,
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastList({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-0 right-0 z-[100] flex w-full flex-col items-end gap-2 p-4 sm:bottom-4 sm:right-4 sm:w-auto sm:max-w-[380px]"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg sm:w-full ${
            t.type === "success"
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/30"
              : t.type === "error"
                ? "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/30"
                : "border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-900/30"
          }`}
        >
          {t.type === "success" && (
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {t.type === "error" && (
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {t.type === "info" && (
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <p
            className={`min-w-0 flex-1 ${
              t.type === "success"
                ? "text-emerald-800 dark:text-emerald-200"
                : t.type === "error"
                  ? "text-red-800 dark:text-red-200"
                  : "text-blue-800 dark:text-blue-200"
            }`}
          >
            {t.message}
          </p>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200/50 hover:text-zinc-700 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-300"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
