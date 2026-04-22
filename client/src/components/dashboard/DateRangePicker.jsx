import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, ChevronRight, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

const MONTH_DAY_YEAR = { month: "short", day: "numeric", year: "numeric" };

function parseYMD(s) {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toYMD(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const labelFor = (d) => (d ? d.toLocaleDateString("en-US", MONTH_DAY_YEAR) : "");

export default function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  // Working selection lives inside the popover. Only committed on Apply.
  const [draft, setDraft] = useState(() => ({
    from: parseYMD(from),
    to: parseYMD(to),
  }));
  const rootRef = useRef(null);

  // Keep draft in sync if parent changes externally (e.g. Clear filters).
  useEffect(() => {
    setDraft({ from: parseYMD(from), to: parseYMD(to) });
  }, [from, to]);

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasRange = !!from || !!to;

  const triggerLabel = useMemo(() => {
    const a = parseYMD(from);
    const b = parseYMD(to);
    if (a && b) return `${labelFor(a)} — ${labelFor(b)}`;
    if (a) return `${labelFor(a)} — …`;
    if (b) return `… — ${labelFor(b)}`;
    return "Date range";
  }, [from, to]);

  const apply = () => {
    onChange({
      dateFrom: draft?.from ? toYMD(draft.from) : "",
      dateTo: draft?.to ? toYMD(draft.to) : "",
    });
    setOpen(false);
  };

  const clearAll = (e) => {
    e.stopPropagation();
    setDraft({ from: undefined, to: undefined });
    onChange({ dateFrom: "", dateTo: "" });
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger chip — matches the look of the other FilterBar chips */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-normal transition-all outline-none ${
          open
            ? "bg-white dark:bg-gray-900 border border-accent ring-2 ring-accent/10"
            : "bg-gray-50 dark:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
        }`}
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">
          Date
        </span>
        <span
          className={`${
            hasRange ? "text-gray-800 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"
          } tabular-nums`}
        >
          {triggerLabel}
        </span>
        {hasRange && (
          <span
            role="button"
            tabIndex={0}
            onClick={clearAll}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clearAll(e)}
            className="ml-1 p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
            aria-label="clear date range"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-[calc(100%+8px)] z-40 rdp-theme"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-premium p-1 overflow-hidden">
              {/* Header: show current draft range */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <DateChip value={draft?.from} placeholder="Start" />
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                  <DateChip value={draft?.to} placeholder="End" />
                </div>
                <button
                  type="button"
                  onClick={() => setDraft({ from: undefined, to: undefined })}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
                  aria-label="reset"
                  disabled={!draft?.from && !draft?.to}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <DayPicker
                mode="range"
                selected={draft}
                onSelect={(r) => setDraft(r || { from: undefined, to: undefined })}
                numberOfMonths={2}
                pagedNavigation
                showOutsideDays={false}
                weekStartsOn={1}
              />

              <div className="flex items-center justify-end gap-2 px-3 py-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-dark transition-all shadow shadow-accent/20"
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DateChip({ value, placeholder }) {
  return (
    <div
      className={`px-2.5 py-1.5 rounded-lg text-[13px] font-medium tabular-nums bg-gray-50 dark:bg-gray-800 ${
        value ? "text-gray-800 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"
      }`}
    >
      {value ? labelFor(value) : placeholder}
    </div>
  );
}
