import React from "react";
import { Search, X, CreditCard, DollarSign } from "lucide-react";
import DateRangePicker from "./DateRangePicker";

const CARD_TYPES = [
  { value: "", label: "All cards" },
  { value: "Visa", label: "Visa" },
  { value: "MasterCard", label: "MasterCard" },
  { value: "Amex", label: "Amex" },
  { value: "Discover", label: "Discover" },
];

export default function FilterBar({ filters, onChange, onClear, isDirty }) {
  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <div className="space-y-4">
      {/* Row 1: search + clear */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search card number…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-transparent rounded-xl text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 font-normal focus:border-accent focus:ring-2 focus:ring-accent/10 outline-none transition-all"
          />
        </div>

        {isDirty && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* Row 2: card type · date range · amount range */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterChip icon={CreditCard} label="Card">
          <select
            value={filters.cardType}
            onChange={(e) => set({ cardType: e.target.value })}
            className="bg-transparent border-none outline-none text-sm font-normal text-gray-800 dark:text-gray-100 pr-2 cursor-pointer"
          >
            {CARD_TYPES.map((t) => (
              <option key={t.value || "all"} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FilterChip>

        <DateRangePicker
          from={filters.dateFrom}
          to={filters.dateTo}
          onChange={(patch) => set(patch)}
        />

        <FilterChip icon={DollarSign} label="Amount">
          <input
            type="number"
            step="0.01"
            placeholder="Min"
            aria-label="Minimum amount"
            value={filters.amountMin}
            onChange={(e) => set({ amountMin: e.target.value })}
            className="bg-transparent border-none outline-none text-sm font-normal text-gray-800 dark:text-gray-100 w-16 tabular-nums placeholder:text-gray-400 dark:placeholder:text-gray-500 text-right"
          />
          <span className="text-gray-300 select-none text-sm leading-none" aria-hidden>
            –
          </span>
          <input
            type="number"
            step="0.01"
            placeholder="Max"
            aria-label="Maximum amount"
            value={filters.amountMax}
            onChange={(e) => set({ amountMax: e.target.value })}
            className="bg-transparent border-none outline-none text-sm font-normal text-gray-800 dark:text-gray-100 w-16 tabular-nums placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </FilterChip>
      </div>
    </div>
  );
}

function FilterChip({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-transparent rounded-xl px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10 transition-all">
      <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}
