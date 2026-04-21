import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Trash2,
  Edit3,
  Search,
  Upload as UploadIcon,
  PenLine,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import FilterBar from "./FilterBar";
import CardBrandLogo from "./CardBrandLogo";
import { formatCurrency, maskCardNumber } from "../../lib/utils";
import { useDebounce } from "../../hooks/useDebounce";
import { useToast } from "../../hooks/useToast";
import { errorMessage } from "../../services/api";
import { listTransactions } from "../../services/transactions";

const PAGE_SIZE = 8;

const DEFAULT_FILTERS = {
  search: "",
  cardType: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

// UI sort key → backend sort_by column
const SORT_MAP = {
  amount: "amount",
  timestamp: "transaction_date",
  cardNumber: "card_number",
};

function buildQuery(filters, debouncedSearch, page, sortBy, sortDir) {
  const params = {
    page,
    page_size: PAGE_SIZE,
    sort_by: SORT_MAP[sortBy] || sortBy,
    sort_dir: sortDir,
  };
  if (debouncedSearch) params.search = debouncedSearch;
  if (filters.cardType) params.card_type = filters.cardType;
  if (filters.dateFrom) params.date_from = `${filters.dateFrom}T00:00:00`;
  if (filters.dateTo) params.date_to = `${filters.dateTo}T23:59:59`;
  if (filters.amountMin !== "") params.amount_min = filters.amountMin;
  if (filters.amountMax !== "") params.amount_max = filters.amountMax;
  return params;
}

export default function DataGrid({ onDelete, onEdit, refreshKey }) {
  const toast = useToast();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const debouncedSearch = useDebounce(filters.search, 300);

  const isDirty = useMemo(() => {
    return (
      filters.cardType !== "" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== "" ||
      filters.amountMin !== "" ||
      filters.amountMax !== "" ||
      filters.search !== ""
    );
  }, [filters]);

  // Reset to page 1 whenever any filter or sort changes.
  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    filters.cardType,
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
    sortBy,
    sortDir,
  ]);

  // Refetch rows on ANY state change. Every filter = one API call.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTransactions(
      buildQuery(filters, debouncedSearch, page, sortBy, sortDir)
    )
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (!cancelled) toast.error(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch,
    filters.cardType,
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
    page,
    sortBy,
    sortDir,
    refreshKey,
  ]);

  const handleSort = (key) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return key;
    });
  };

  const handleClear = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm flex flex-col min-h-[600px]">
      <div className="p-6 border-b border-gray-50">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              Financial records
            </h2>
            <p className="text-xs text-gray-500 font-normal mt-1">
              {loading
                ? "Loading…"
                : `${total} ${total === 1 ? "record" : "records"} match your filters`}
            </p>
          </div>
        </div>

        <FilterBar
          filters={filters}
          onChange={setFilters}
          onClear={handleClear}
          isDirty={isDirty}
        />
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 text-[11px] font-medium uppercase tracking-wider text-gray-500 border-b border-gray-50">
              <th className="px-6 py-4">Card number</th>
              <th className="px-6 py-4">Type</th>
              <th
                className="px-6 py-4 cursor-pointer hover:text-accent transition-colors"
                onClick={() => handleSort("amount")}
              >
                <SortHeader label="Amount" active={sortBy === "amount"} dir={sortDir} />
              </th>
              <th className="px-6 py-4">Source</th>
              <th className="px-6 py-4">Status</th>
              <th
                className="px-6 py-4 cursor-pointer hover:text-accent transition-colors"
                onClick={() => handleSort("timestamp")}
              >
                <SortHeader label="Time" active={sortBy === "timestamp"} dir={sortDir} />
              </th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <AnimatePresence mode="popLayout">
              {items.map((entry) => (
                <motion.tr
                  layout
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="group hover:bg-gray-50/30 transition-all duration-200"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <CardBrandLogo type={entry.cardType} />
                      <div className="min-w-0">
                        <span className="font-mono text-sm font-normal tracking-tight text-gray-800">
                          {maskCardNumber(entry.cardNumber)}
                        </span>
                        {entry.remarks && (
                          <p className="text-[11px] text-gray-400 font-normal mt-0.5 truncate max-w-[220px]">
                            {entry.remarks}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="inline-flex items-center rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {entry.cardType || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`font-medium text-sm tracking-tight tabular-nums ${
                        entry.amount < 0 ? "text-rose-600" : "text-gray-900"
                      }`}
                    >
                      {formatCurrency(entry.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <SourceBadge source={entry.source} fileName={entry.fileName} />
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs text-gray-500 font-normal">
                      {entry.timestamp
                        ? new Date(entry.timestamp).toLocaleDateString()
                        : "—"}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => onEdit(entry)}
                        className="p-2 text-gray-400 hover:text-accent rounded-lg hover:bg-accent/5 transition-all"
                        aria-label="edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(entry.id)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                        aria-label="delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Search className="w-10 h-10 opacity-20" />
                    <p className="text-sm font-normal">
                      No records match your filters
                    </p>
                    {isDirty && (
                      <button
                        className="text-xs text-accent hover:underline font-medium"
                        onClick={handleClear}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-6 border-t border-gray-50 flex items-center justify-between">
        <p className="text-xs text-gray-500 font-normal">
          Page{" "}
          <span className="font-medium text-gray-700">{page}</span> of{" "}
          <span className="font-medium text-gray-700">{totalPages}</span>
        </p>

        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-2 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="p-2 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortHeader({ label, active, dir }) {
  return (
    <div className="flex items-center gap-2">
      {label}
      <ArrowUpDown
        className={`w-3 h-3 ${active ? "text-accent" : "text-gray-300"} ${
          active && dir === "asc" ? "rotate-180" : ""
        } transition-transform`}
      />
    </div>
  );
}

const STATUS_STYLES = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  failed: "bg-rose-50 text-rose-700 border-rose-100",
  pending: "bg-amber-50 text-amber-700 border-amber-100",
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || "bg-gray-50 text-gray-600 border-gray-100";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "success"
            ? "bg-emerald-500"
            : status === "failed"
            ? "bg-rose-500"
            : status === "pending"
            ? "bg-amber-500"
            : "bg-gray-400"
        }`}
      />
      {status || "—"}
    </span>
  );
}

function SourceBadge({ source, fileName }) {
  const isUpload = source === "file_upload";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
          isUpload
            ? "bg-sky-50 text-sky-700 border-sky-100"
            : "bg-violet-50 text-violet-700 border-violet-100"
        }`}
      >
        {isUpload ? (
          <UploadIcon className="w-3 h-3" />
        ) : (
          <PenLine className="w-3 h-3" />
        )}
        {isUpload ? "Upload" : "Batch"}
      </span>
      {fileName && (
        <span className="text-[11px] text-gray-400 font-normal truncate max-w-[140px]">
          {fileName}
        </span>
      )}
    </div>
  );
}
