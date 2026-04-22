import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

const STATUSES = [
  { value: "success", label: "Success", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { value: "pending", label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-100" },
  { value: "failed", label: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-100" },
];

export default function EditTransactionModal({ open, entry, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("success");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!entry) return;
    setAmount(String(entry.amount ?? ""));
    setStatus(entry.status ?? "success");
    setRemarks(entry.remarks ?? "");
    setErr(null);
  }, [entry, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (Number.isNaN(amt)) {
      setErr("Amount must be a number");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSubmit({ amount: amt, status, remarks: remarks || null });
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && entry && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-premium overflow-hidden"
          >
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 tracking-tight">
                  Edit transaction
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-1 font-mono">
                  {entry.cardNumber}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                aria-label="close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1 mb-2 block">
                  Amount
                </label>
                <div className="relative bg-gray-50 dark:bg-gray-800 rounded-xl border border-transparent focus-within:border-accent transition-all">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm font-normal">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-sm font-medium text-gray-800 dark:text-gray-100 pl-8 pr-4 py-3 tabular-nums"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1 mb-2 block">
                  Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStatus(s.value)}
                      className={cn(
                        "py-2.5 rounded-xl border text-[12px] font-medium transition-all",
                        status === s.value
                          ? s.cls
                          : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1 mb-2 block">
                  Remarks
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Optional notes…"
                  className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl border border-transparent focus:border-accent focus:outline-none text-sm font-normal text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-3 transition-all resize-none"
                />
              </div>

              {err && (
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-xs font-medium bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-100 dark:border-red-900">
                  {err}
                </div>
              )}
            </form>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-medium text-white bg-black dark:bg-accent rounded-xl hover:bg-gray-900 dark:hover:bg-accent-dark transition-all disabled:opacity-50 shadow-lg shadow-black/10"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
