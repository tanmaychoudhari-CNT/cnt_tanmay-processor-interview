import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, ...toast }]);
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
                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                : t.type === "error"
                ? "bg-red-50 border-red-100 text-red-800"
                : "bg-sky-50 border-sky-100 text-sky-800"
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
