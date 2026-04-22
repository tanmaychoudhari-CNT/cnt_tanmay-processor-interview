import React from "react";
import { motion } from "motion/react";
import {
  Users,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Crown,
  CalendarDays,
} from "lucide-react";
import { cn, formatCurrency, formatNumber } from "../../lib/utils";

export default function DetailedSummary({ stats }) {
  const items = [
    {
      label: "Total entries",
      value: stats.totalEntries,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total amount",
      value: formatCurrency(stats.totalAmount),
      icon: DollarSign,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Average amount",
      value: formatCurrency(stats.averageAmount),
      icon: Activity,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Highest",
      value: formatCurrency(stats.highestAmount),
      icon: ArrowUpRight,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Lowest",
      value: formatCurrency(stats.lowestAmount),
      icon: ArrowDownRight,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      label: "Unique cards",
      value: formatNumber(stats.uniqueCards ?? 0),
      icon: CreditCard,
      color: "text-sky-600",
      bg: "bg-sky-50",
    },
    {
      label: "Top brand",
      value: stats.topBrand ?? "—",
      icon: Crown,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Today",
      value: formatNumber(stats.todayCount ?? 0),
      icon: CalendarDays,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 space-y-6 h-full transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50">Summary</h3>
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </div>

      <div className="space-y-4">
        {items.map((item, i) => {
          const negative = String(item.value).includes("-");
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className="flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg transition-transform group-hover:scale-110",
                    item.bg,
                    item.color
                  )}
                >
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-normal text-gray-600 dark:text-gray-300">{item.label}</span>
              </div>
              <span
                className={cn(
                  "text-sm font-medium tracking-tight tabular-nums",
                  negative ? "text-rose-500" : "text-gray-900 dark:text-gray-50"
                )}
              >
                {item.value}
              </span>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}
