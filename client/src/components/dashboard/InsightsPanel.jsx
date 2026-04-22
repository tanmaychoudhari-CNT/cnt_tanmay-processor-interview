import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Upload, PenLine } from "lucide-react";
import CardBrandLogo from "./CardBrandLogo";
import { formatCurrency, formatNumber, maskCardNumber } from "../../lib/utils";

// Two side-by-side insight cards that summarize the loaded dataset from a
// different angle than the big KPIs. Top-cards ranking comes from the
// server's /reports/by-card aggregation (full dataset); source-split is
// derived from `entries` (capped at 10k by the list endpoint — acceptable
// since the server doesn't expose a source-breakdown endpoint yet).
export default function InsightsPanel({ entries, byCard = [] }) {
  const topCards = useMemo(() => {
    if (byCard.length) {
      return byCard.slice(0, 5).map((c) => ({
        cardNumber: c.card_number,
        cardType: c.card_type,
        total: Math.abs(Number(c.total_amount ?? 0)),
        count: c.count,
      }));
    }
    const acc = new Map();
    for (const e of entries) {
      const key = e.cardNumber;
      if (!key) continue;
      const prev = acc.get(key) ?? {
        cardNumber: key,
        cardType: e.cardType,
        total: 0,
        count: 0,
      };
      prev.total += Math.abs(Number(e.amount) || 0);
      prev.count += 1;
      acc.set(key, prev);
    }
    return Array.from(acc.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [entries, byCard]);

  const sourceSplit = useMemo(() => {
    let upload = 0;
    let manual = 0;
    for (const e of entries) {
      if (e.source === "file_upload") upload += 1;
      else if (e.source === "manual_entry") manual += 1;
    }
    const total = upload + manual;
    return {
      upload,
      manual,
      total,
      uploadPct: total ? Math.round((upload / total) * 100) : 0,
      manualPct: total ? Math.round((manual / total) * 100) : 0,
    };
  }, [entries]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Top cards by total spend */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Top cards by volume
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-1">
              Biggest absolute spenders
            </p>
          </div>
        </div>

        {topCards.length === 0 ? (
          <EmptyState label="No transactions yet" />
        ) : (
          <ul className="space-y-3">
            {topCards.map((c, i) => (
              <motion.li
                key={c.cardNumber}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                className="flex items-center gap-3 py-2"
              >
                <span className="w-6 h-6 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[11px] font-medium flex items-center justify-center">
                  {i + 1}
                </span>
                <CardBrandLogo type={c.cardType} />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-gray-800 dark:text-gray-100 truncate">
                    {maskCardNumber(c.cardNumber)}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-normal mt-0.5">
                    {formatNumber(c.count)} transactions
                  </p>
                </div>
                <span className="text-sm font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-50">
                  {formatCurrency(c.total)}
                </span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Source breakdown: how data arrived (file upload vs manual entry) */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Processing source
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-1">
              Batch vs manual
            </p>
          </div>
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
            {formatNumber(sourceSplit.total)} total
          </span>
        </div>

        {sourceSplit.total === 0 ? (
          <EmptyState label="No source data yet" />
        ) : (
          <div className="space-y-6">
            <SourceRow
              icon={Upload}
              label="Batch"
              count={sourceSplit.upload}
              pct={sourceSplit.uploadPct}
              colorClass="bg-sky-500"
              badgeClass="bg-sky-50 text-sky-700 border-sky-100"
            />
            <SourceRow
              icon={PenLine}
              label="Manual"
              count={sourceSplit.manual}
              pct={sourceSplit.manualPct}
              colorClass="bg-violet-500"
              badgeClass="bg-violet-50 text-violet-700 border-violet-100"
            />

            {/* Combined stacked bar for a quick visual ratio. */}
            <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-sky-500"
                style={{ width: `${sourceSplit.uploadPct}%` }}
              />
              <div
                className="h-full bg-violet-500"
                style={{ width: `${sourceSplit.manualPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceRow({ icon: Icon, label, count, pct, colorClass, badgeClass }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border ${badgeClass}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</span>
        </div>
        <span className="text-[13px] font-medium tabular-nums text-gray-600 dark:text-gray-300">
          {formatNumber(count)}{" "}
          <span className="text-gray-400 dark:text-gray-500 font-normal">· {pct}%</span>
        </span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex items-center justify-center h-32 text-sm text-gray-400 dark:text-gray-500 font-normal">
      {label}
    </div>
  );
}
