// Top-of-page KPI row — four headline metrics. Numbers come straight from
// the /reports/summary response so they reflect the entire dataset, not
// just the in-memory entries window.

import React from "react";
import { motion } from "motion/react";
import { Users, DollarSign, TrendingUp, ArrowUpRight } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "../../lib/utils";

export default function SummaryPanel({ stats }) {
  const cards = [
    { label: "Total Entries", value: formatNumber(stats.totalEntries), icon: Users, color: "bg-black" },
    { label: "Total Amount", value: formatCurrency(stats.totalAmount), icon: DollarSign, color: "bg-accent" },
    { label: "Average Value", value: formatCurrency(stats.averageAmount), icon: TrendingUp, color: "bg-black" },
    { label: "Highest Txn", value: formatCurrency(stats.highestAmount ?? 0), icon: ArrowUpRight, color: "bg-accent" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-50 dark:border-gray-800 group hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/40 transition-all duration-300"
        >
          <div className="flex items-start mb-4">
            <div className={cn("p-3 rounded-xl text-white shadow-lg", card.color)}>
              <card.icon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-normal">{card.label}</p>
          <h3 className="text-2xl font-semibold mt-1 tracking-tight text-gray-900 dark:text-gray-50">{card.value}</h3>
        </motion.div>
      ))}
    </div>
  );
}
