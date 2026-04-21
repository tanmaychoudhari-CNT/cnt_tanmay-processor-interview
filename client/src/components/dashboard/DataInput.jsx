import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, FileCode, FileType, Plus, Save, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useToast } from "../../hooks/useToast";
import { errorMessage } from "../../services/api";
import { bulkCreateTransactions, uploadFile } from "../../services/transactions";

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

export function validateAmount(value) {
  if (value === "" || value === null || value === undefined)
    return "Amount is required";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Amount must be a number";
  if (n <= 0) return "Amount must be greater than zero";
  return null;
}

// Timestamp is optional — the backend falls back to "now" when it's null.
// Guard only against a malformed value the datetime-local input can't produce
// on its own but might appear if the row is ever edited programmatically.
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
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|json|xml)$/i.test(file.name)) {
      toast.error("Only CSV, JSON, and XML files are accepted");
      return;
    }

    setIsParsing(true);
    setUploadProgress(0);
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addManualRow = () =>
    setManualEntries((prev) => [...prev, emptyRow()]);
  const removeManualRow = (index) =>
    setManualEntries((prev) => prev.filter((_, i) => i !== index));
  const updateManualRow = (index, field, value) =>
    setManualEntries((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], [field]: value };
      return next;
    });

  const submitManual = async () => {
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
      // datetime-local gives a local-time string; Date() treats it as local and
      // the service layer converts to UTC ISO before POST.
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
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="flex border-b border-gray-50">
        <button
          onClick={() => setActiveTab("upload")}
          className={cn(
            "flex-1 py-4 text-[11px] font-medium uppercase tracking-wider transition-all",
            activeTab === "upload"
              ? "bg-black text-white"
              : "bg-white text-gray-400 hover:text-black"
          )}
        >
          File Import
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={cn(
            "flex-1 py-4 text-[11px] font-medium uppercase tracking-wider transition-all",
            activeTab === "manual"
              ? "bg-black text-white"
              : "bg-white text-gray-400 hover:text-black"
          )}
        >
          Manual Entry
        </button>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {activeTab === "upload" ? (
          <div
            className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-100 rounded-2xl group hover:border-accent hover:bg-accent/5 transition-all cursor-pointer min-h-[320px]"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.json,.xml"
              className="hidden"
            />

            <div className="w-16 h-16 bg-gray-50 flex items-center justify-center rounded-2xl mb-4 group-hover:scale-110 transition-all duration-300">
              <Upload className="w-8 h-8 text-gray-400 group-hover:text-accent" />
            </div>

            <p className="text-sm font-medium text-gray-800">
              Choose file to upload
            </p>
            <p className="text-xs text-gray-500 mt-1 font-normal">
              Supports CSV, JSON, and XML formats
            </p>

            <div className="mt-8 flex gap-3 text-gray-300">
              <FileType className="w-5 h-5" />
              <FileCode className="w-5 h-5" />
            </div>

            {isParsing && (
              <div className="mt-6 w-full max-w-xs">
                <div className="flex items-center gap-2 text-accent font-medium text-[11px] uppercase tracking-wider mb-2 justify-center">
                  <div className="w-2 h-2 bg-accent rounded-full animate-ping" />
                  Parsing file… {uploadProgress}%
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px] mb-4 pr-2">
              <AnimatePresence initial={false}>
                {manualEntries.map((row, index) => {
                  const digits = String(row.cardNumber).replace(/\D/g, "");
                  const cardError = digits ? validateCard(digits) : null;
                  const amountError =
                    row.amount !== "" ? validateAmount(row.amount) : null;
                  const tsError = validateTimestamp(row.timestamp);
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      key={index}
                      className="space-y-1"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex-1 bg-gray-50 rounded-xl px-4 py-3 border transition-all focus-within:border-accent",
                            cardError ? "border-red-300" : "border-transparent"
                          )}
                        >
                          <input
                            type="text"
                            placeholder="1234 5678 9012 3456"
                            value={formatCardNumber(digits)}
                            onChange={(ev) => {
                              const raw = ev.target.value.replace(/\D/g, "");
                              const capped = raw.slice(0, maxDigitsFor(raw));
                              updateManualRow(index, "cardNumber", capped);
                            }}
                            inputMode="numeric"
                            autoComplete="cc-number"
                            maxLength={19}
                            className="bg-transparent border-none outline-none text-sm font-mono font-normal w-full text-gray-800 placeholder:text-gray-400 tracking-wide"
                          />
                        </div>
                        <div
                          className={cn(
                            "w-48 bg-gray-50 rounded-xl px-4 py-3 border transition-all focus-within:border-accent",
                            tsError ? "border-red-300" : "border-transparent"
                          )}
                        >
                          <input
                            type="datetime-local"
                            value={row.timestamp}
                            onChange={(ev) =>
                              updateManualRow(index, "timestamp", ev.target.value)
                            }
                            className="bg-transparent border-none outline-none text-sm font-normal w-full text-gray-800 placeholder:text-gray-400"
                          />
                        </div>
                        <div
                          className={cn(
                            "w-32 bg-gray-50 rounded-xl px-4 py-3 border transition-all focus-within:border-accent relative",
                            amountError ? "border-red-300" : "border-transparent"
                          )}
                        >
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-normal leading-none">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(ev) =>
                              updateManualRow(index, "amount", ev.target.value)
                            }
                            className="bg-transparent border-none outline-none text-sm font-medium w-full pl-4 tabular-nums text-gray-800 placeholder:text-gray-400 placeholder:font-normal"
                          />
                        </div>
                        <button
                          onClick={() => removeManualRow(index)}
                          className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          aria-label="remove row"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {(cardError || amountError || tsError) && (
                        <p className="text-[11px] text-red-500 pl-4 font-normal">
                          {cardError || amountError || tsError}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="flex gap-3">
              <button
                onClick={addManualRow}
                className="flex-[2] py-3.5 bg-gray-100 text-gray-800 rounded-xl font-medium text-[13px] tracking-wide hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add row
              </button>
              <button
                onClick={submitManual}
                className="flex-[3] py-3.5 bg-black text-white rounded-xl font-medium text-[13px] tracking-wide hover:bg-gray-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/10"
              >
                <Save className="w-4 h-4" /> Add all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
