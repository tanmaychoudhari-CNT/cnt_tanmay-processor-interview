// App-wide toast notifications.
//
// The provider owns the queue + the fixed-position container that renders
// them. Call sites use `const toast = useToast(); toast.success("...")`.
// Kept intentionally small — no queue limit, no positioning API, no
// actions. If we ever need those, swap in a library rather than growing
// this.

import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    // Random 10-ish char id — collision-proof enough for a visible queue
    // that rarely exceeds a handful of entries at once.
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, ...toast }]);
    // Auto-dismiss. Default of 3.5s is long enough to read, short enough
    // not to stack up when multiple async ops resolve together.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration ?? 3500);
  }, []);

  const api = {
    success: (message) => push({ type: "success", message }),
    error: (message) => push({ type: "error", message }),
    info: (message) => push({ type: "info", message }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`fade-in rounded-xl border px-4 py-3 text-sm font-normal shadow-premium ${
              t.type === "success"
                ? "bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-900 dark:text-emerald-200"
                : t.type === "error"
                ? "bg-red-50 border-red-100 text-red-800 dark:bg-red-950/50 dark:border-red-900 dark:text-red-200"
                : "bg-sky-50 border-sky-100 text-sky-800 dark:bg-sky-950/50 dark:border-sky-900 dark:text-sky-200"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
