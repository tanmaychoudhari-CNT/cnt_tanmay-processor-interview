// Data injection panel — the tabbed card at the top of the dashboard that
// lets operators ingest transactions via either file upload or manual
// row-by-row entry.
//
// Validation lives in this file (formatCardNumber, validateCard,
// validateAmount, validateTimestamp) because both paths share it and
// because it's where the UI-specific "format as you type" rules belong.
// The backend re-validates everything — these helpers are UX polish, not
// the security boundary.

import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UploadCloud,
  FileSpreadsheet,
  FileJson,
  FileCode2,
  Plus,
  Save,
  X,
  Sparkles,
  CircleCheck,
  CircleAlert,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useToast } from "../../hooks/useToast";
import { errorMessage } from "../../api/api";
import { bulkCreateTransactions, uploadFile } from "../../api/transactions";

const emptyRow = () => ({ cardNumber: "", amount: "", timestamp: "" });

// Amex (leading "3") is always 15 digits. Visa / MasterCard / Discover
// (leading 4/5/6) accept both 15- and 16-digit cards.
export const maxDigitsFor = (digits) => (digits.startsWith("3") ? 15 : 16);

// Grouping rule, independent of brand:
//   * 15 digits -> 4-6-5   (e.g. "1234 567890 12345")
//   * 16 digits -> 4-4-4-4 (e.g. "1234 5678 9012 3456")
//   * anything else (partial entry) -> groups of 4 while typing
export function formatCardNumber(digits) {
  if (!digits) return "";
  if (digits.length === 15) {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].join(
      " "
    );
  }
  if (digits.length === 16) {
    return [
      digits.slice(0, 4),
      digits.slice(4, 8),
      digits.slice(8, 12),
      digits.slice(12, 16),
    ].join(" ");
  }
  return digits.match(/.{1,4}/g)?.join(" ") ?? "";
}

export function validateCard(digits) {
  if (!digits) return "Card number is required";
  const leading = digits[0];
  if (!"3456".includes(leading))
    return "Card must start with 3 (Amex), 4 (Visa), 5 (MasterCard), or 6 (Discover)";
  if (leading === "3" && digits.length !== 15)
    return "Amex cards must be exactly 15 digits";
  if (leading !== "3" && digits.length !== 15 && digits.length !== 16)
    return "Visa / MasterCard / Discover cards must be 15 or 16 digits";
  return null;
}

// Returns an error string, or null if the value is a valid positive amount.
export function validateAmount(value) {
  if (value === "" || value === null || value === undefined)
    return "Amount is required";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Amount must be a number";
  if (n <= 0) return "Amount must be greater than zero";
  return null;
}

// Timestamp is optional — the backend falls back to "now" when it's null.
export function validateTimestamp(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "Timestamp is not a valid date";
  return null;
}

export default function DataInput({ onDataChanged }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("upload");
  const [manualEntries, setManualEntries] = useState([emptyRow()]);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingName, setUploadingName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── File upload handling ─────────────────────────────────────────────
  // Fires on both the file-picker change and the drop event. Extension
  // check here is a UX nicety — the backend does real MIME sniffing.
  const startUpload = async (file) => {
    if (!file) return;
    if (!/\.(csv|json|xml)$/i.test(file.name)) {
      toast.error("Only CSV, JSON, and XML files are accepted");
      return;
    }

    setIsParsing(true);
    setUploadProgress(0);
    setUploadingName(file.name);
    try {
      const result = await uploadFile(file, setUploadProgress);
      toast.success(
        `${result.filename}: ${result.accepted} accepted, ${result.rejected} rejected`
      );
      onDataChanged?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsParsing(false);
      setUploadingName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e) => startUpload(e.target.files?.[0]);

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) startUpload(file);
  };

  // ── Manual entry handling ────────────────────────────────────────────
  const addManualRow = () =>
    setManualEntries((prev) => [...prev, emptyRow()]);
  const removeManualRow = (index) =>
    setManualEntries((prev) =>
      prev.length > 1
        ? prev.filter((_, i) => i !== index)
        : [emptyRow()] // never go below one row — reset it instead
    );
  const clearAllRows = () => setManualEntries([emptyRow()]);
  const updateManualRow = (index, field, value) =>
    setManualEntries((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], [field]: value };
      return next;
    });

  // Per-row validation summary — used for the footer bar and submit gating.
  const rowStatuses = useMemo(
    () =>
      manualEntries.map((e) => {
        const digits = String(e.cardNumber).replace(/\D/g, "");
        const c = validateCard(digits);
        const a = validateAmount(e.amount);
        const t = validateTimestamp(e.timestamp);
        const empty = !digits && e.amount === "" && !e.timestamp;
        return { valid: !c && !a && !t, error: c || a || t, empty };
      }),
    [manualEntries]
  );
  const validCount = rowStatuses.filter((r) => r.valid).length;
  const nonEmptyCount = rowStatuses.filter((r) => !r.empty).length;

  const submitManual = async () => {
    // Re-run validation on the full set before submit — the submit button
    // is disabled when any row is invalid, but this is belt-and-braces so
    // programmatic triggers (Enter key on a focused input, tests, etc.)
    // can't bypass the check.
    const normalized = manualEntries.map((e) => ({
      cardNumber: String(e.cardNumber).replace(/\D/g, ""),
      amount: e.amount,
      timestamp: e.timestamp,
    }));

    const cardErr = normalized.map((e) => validateCard(e.cardNumber));
    const amtErr = normalized.map((e) => validateAmount(e.amount));
    const tsErr = normalized.map((e) => validateTimestamp(e.timestamp));
    const hasErrors =
      cardErr.some(Boolean) || amtErr.some(Boolean) || tsErr.some(Boolean);
    if (hasErrors) {
      const firstErr =
        cardErr.find(Boolean) || amtErr.find(Boolean) || tsErr.find(Boolean);
      toast.error(firstErr);
      return;
    }

    const payload = normalized.map((e) => ({
      cardNumber: e.cardNumber,
      amount: Number(e.amount),
      timestamp: e.timestamp ? new Date(e.timestamp).getTime() : null,
    }));

    try {
      const res = await bulkCreateTransactions(payload);
      toast.success(
        `Batch pushed — ${res.accepted} accepted, ${res.rejected} rejected`
      );
      setManualEntries([emptyRow()]);
      onDataChanged?.();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden h-full flex flex-col transition-colors">
      {/* ── Header: segmented tabs ───────────────────────────────────── */}
      <div className="px-6 pt-5">
        <SegmentedTabs active={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="px-6 pb-6 flex-1 flex flex-col">
        {activeTab === "upload" ? (
          <UploadPanel
            fileInputRef={fileInputRef}
            isDragging={isDragging}
            isParsing={isParsing}
            uploadProgress={uploadProgress}
            uploadingName={uploadingName}
            onDrop={onDrop}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onChange={handleFileUpload}
          />
        ) : (
          <ManualPanel
            entries={manualEntries}
            rowStatuses={rowStatuses}
            validCount={validCount}
            nonEmptyCount={nonEmptyCount}
            onUpdate={updateManualRow}
            onRemove={removeManualRow}
            onAdd={addManualRow}
            onClearAll={clearAllRows}
            onSubmit={submitManual}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

function SegmentedTabs({ active, onChange }) {
  const tabs = [
    { id: "upload", label: "File Import", icon: UploadCloud },
    { id: "manual", label: "Manual Entry", icon: Sparkles },
  ];

  return (
    <div
      role="tablist"
      className="relative inline-flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl"
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] rounded-lg transition-colors flex items-center gap-2",
              isActive
                ? "text-gray-900 dark:text-gray-50"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="tab-pill"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 bg-white dark:bg-gray-950 rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              />
            )}
            <t.icon className="relative w-3.5 h-3.5" />
            <span className="relative">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Upload (drag + drop) ──────────────────────────────────────────────
function UploadPanel({
  fileInputRef,
  isDragging,
  isParsing,
  uploadProgress,
  uploadingName,
  onDrop,
  onDragEnter,
  onDragLeave,
  onChange,
}) {
  return (
    <div
      onClick={() => !isParsing && fileInputRef.current?.click()}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative mt-6 flex-1 flex flex-col items-center justify-center rounded-2xl",
        "border-2 border-dashed transition-all cursor-pointer min-h-[320px] overflow-hidden",
        isDragging
          ? "border-accent bg-accent/5 dark:bg-accent/10 scale-[1.01]"
          : "border-gray-200 dark:border-gray-800 hover:border-accent/60 hover:bg-accent/[0.03] dark:hover:bg-accent/[0.06]"
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={onChange}
        accept=".csv,.json,.xml"
        className="hidden"
      />

      {/* Radial accent glow (gentle background texture) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.25]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(0,160,221,0.14), transparent 60%)",
        }}
      />

      {!isParsing ? (
        <>
          {/* Animated upload icon */}
          <motion.div
            animate={{ y: isDragging ? -6 : 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 16 }}
            className="relative w-16 h-16 rounded-2xl bg-white dark:bg-gray-900 shadow-[0_10px_30px_-10px_rgba(0,160,221,0.35)] ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center mb-5"
          >
            <UploadCloud
              className={cn(
                "w-7 h-7 transition-colors",
                isDragging ? "text-accent" : "text-gray-400 dark:text-gray-500"
              )}
            />
          </motion.div>

          <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-50 tracking-tight">
            {isDragging ? "Drop to upload" : "Drag and drop a file here"}
          </p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 font-normal">
            or{" "}
            <span className="text-accent font-medium underline underline-offset-2">
              click to browse
            </span>{" "}
            from your computer
          </p>

          {/* Format chips */}
          <div className="mt-6 flex items-center gap-2">
            <FormatChip icon={FileSpreadsheet} label="CSV" dot="#16A34A" />
            <FormatChip icon={FileJson} label="JSON" dot="#F59E0B" />
            <FormatChip icon={FileCode2} label="XML" dot="#8B5CF6" />
          </div>

          <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Max 10 MB per file
          </p>
        </>
      ) : (
        <div className="w-full max-w-sm px-6 flex flex-col items-center">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4"
          >
            <UploadCloud className="w-6 h-6 text-accent" />
          </motion.div>

          <p className="text-[13px] font-medium text-gray-900 dark:text-gray-50 truncate max-w-full">
            {uploadingName || "Uploading…"}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-normal mt-1">
            Parsing batch · {uploadProgress}%
          </p>

          <div className="mt-4 w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FormatChip({ icon: Icon, label, dot }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-3 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dot }}
      />
      <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
      {label}
    </span>
  );
}

// ─── Manual entry ──────────────────────────────────────────────────────
function ManualPanel({
  entries,
  rowStatuses,
  validCount,
  nonEmptyCount,
  onUpdate,
  onRemove,
  onAdd,
  onClearAll,
  onSubmit,
}) {
  return (
    <div className="flex-1 flex flex-col mt-6">
      {/* Header with entry count + quick clear */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <h4 className="text-[13px] font-semibold text-gray-900 dark:text-gray-50">
            Transactions
          </h4>
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
            {entries.length} {entries.length === 1 ? "row" : "rows"}
          </span>
        </div>
        {nonEmptyCount > 0 && (
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto max-h-[420px] space-y-2.5 pr-1 -mr-1">
        <AnimatePresence initial={false}>
          {entries.map((row, index) => {
            const status = rowStatuses[index];
            const digits = String(row.cardNumber).replace(/\D/g, "");
            const cardError = digits ? validateCard(digits) : null;
            const amountError =
              row.amount !== "" ? validateAmount(row.amount) : null;
            const tsError = validateTimestamp(row.timestamp);
            const anyError = cardError || amountError || tsError;

            return (
              <motion.div
                key={index}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "relative rounded-xl bg-gray-50/70 dark:bg-gray-800/50 border transition-colors",
                  anyError
                    ? "border-rose-200 dark:border-rose-900/60"
                    : status?.valid
                    ? "border-emerald-200/70 dark:border-emerald-900/50"
                    : "border-transparent"
                )}
              >
                <div className="flex items-center gap-2.5 p-2.5">
                  {/* Row index badge */}
                  <span
                    className={cn(
                      "w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-[11px] font-semibold tabular-nums",
                      anyError
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"
                        : status?.valid
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-200 dark:ring-gray-700"
                    )}
                  >
                    {index + 1}
                  </span>

                  {/* Card number */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      value={formatCardNumber(digits)}
                      onChange={(ev) => {
                        const raw = ev.target.value.replace(/\D/g, "");
                        const capped = raw.slice(0, maxDigitsFor(raw));
                        onUpdate(index, "cardNumber", capped);
                      }}
                      inputMode="numeric"
                      autoComplete="cc-number"
                      maxLength={19}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2 text-[13px] font-mono tracking-wide text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all"
                    />
                  </div>

                  {/* Timestamp */}
                  <div className="w-44 shrink-0">
                    <input
                      type="datetime-local"
                      value={row.timestamp}
                      onChange={(ev) =>
                        onUpdate(index, "timestamp", ev.target.value)
                      }
                      className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2 text-[12px] text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>

                  {/* Amount */}
                  <div className="w-28 shrink-0 relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[13px]">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(ev) =>
                        onUpdate(index, "amount", ev.target.value)
                      }
                      className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg pl-7 pr-3 py-2 text-[13px] font-medium tabular-nums text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-normal focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none transition-all"
                    />
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => onRemove(index)}
                    className="w-8 h-8 shrink-0 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                    aria-label="remove row"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {anyError && (
                  <p className="pb-2 pl-12 text-[11px] text-rose-500 font-normal">
                    {anyError}
                  </p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* "Add another row" as a subtle dashed row */}
        <button
          onClick={onAdd}
          className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-accent hover:border-accent/60 dark:hover:border-accent/60 transition-colors flex items-center justify-center gap-1.5 text-[12px] font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add row
        </button>
      </div>

      {/* Status footer + submit */}
      <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-[11px] font-medium">
          {nonEmptyCount === 0 ? (
            <span className="text-gray-400 dark:text-gray-500">
              Enter at least one transaction
            </span>
          ) : validCount === entries.length ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CircleCheck className="w-3.5 h-3.5" />
              All {validCount} rows ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <CircleAlert className="w-3.5 h-3.5" />
              {validCount} of {entries.length} valid
            </span>
          )}
        </div>

        <button
          onClick={onSubmit}
          disabled={validCount !== entries.length || nonEmptyCount === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-accent text-white text-[12px] font-semibold tracking-[0.08em] uppercase hover:bg-gray-800 dark:hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-[0_6px_20px_-6px_rgba(0,0,0,0.4)]"
        >
          <Save className="w-4 h-4" /> Add all
        </button>
      </div>
    </div>
  );
}
