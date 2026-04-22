// Dashboard shell — orchestrates every panel on the main page.
//
// State shape:
//   entries  — in-memory list (capped at 10k by listAllTransactions); used
//              by panels that need row-level detail.
//   stats    — headline KPIs, server-computed over the full dataset.
//   reports  — server aggregations (byCardType / byDay / byCard). Feeds the
//              charts so they reflect every row, not just the 10k window.
//
// Two refresh paths: `loadData` (full reload) and `refreshReports` (light
// poll every 15s for chart-only updates).

import React, { useCallback, useEffect, useState } from "react";
import Navbar from "../components/dashboard/Navbar";
import SummaryPanel from "../components/dashboard/SummaryPanel";
import DetailedSummary from "../components/dashboard/DetailedSummary";
import DataInput from "../components/dashboard/DataInput";
import DataGrid from "../components/dashboard/DataGrid";
import ChartsPanel from "../components/dashboard/ChartsPanel";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import EditTransactionModal from "../components/dashboard/EditTransactionModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast";
import { errorMessage } from "../api/api";
import {
  deleteTransaction,
  getByCard,
  getByCardType,
  getByDay,
  getSummary,
  listAllTransactions,
  updateTransaction,
} from "../api/transactions";

// Auto-refresh cadence for live charts. Keeps the dashboard honest without
// hammering the backend — one set of aggregated reports every 15s.
const REFRESH_MS = 15_000;

const initialStats = {
  totalEntries: 0,
  totalAmount: 0,
  averageAmount: 0,
  highestAmount: 0,
  lowestAmount: 0,
  deletedCount: 0,
  uniqueCards: 0,
  topBrand: "—",
  todayCount: 0,
};

// Client-side derivations that aren't worth a dedicated backend endpoint.
// Exported for the unit test.
export function deriveEntryStats(items) {
  const cardSet = new Set();
  const byBrand = {};
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  let todayCount = 0;

  for (const e of items) {
    if (e.cardNumber) cardSet.add(e.cardNumber);
    if (e.cardType) byBrand[e.cardType] = (byBrand[e.cardType] ?? 0) + 1;
    if (typeof e.timestamp === "number" && e.timestamp >= todayMs) todayCount += 1;
  }

  const topBrand =
    Object.entries(byBrand).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return { uniqueCards: cardSet.size, topBrand, todayCount };
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(initialStats);
  // Server-aggregated report data — source of truth for charts.
  const [reports, setReports] = useState({
    byCardType: [],
    byDay: [],
    byCard: [],
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Full reload — entries + summary + aggregated reports.
  const loadData = useCallback(async () => {
    try {
      const [{ items }, s, byCardType, byDay, byCard] = await Promise.all([
        listAllTransactions(),
        getSummary(),
        getByCardType(),
        getByDay(90),
        getByCard(10),
      ]);
      setEntries(items);
      const derived = deriveEntryStats(items);
      setStats({
        totalEntries: s.total_entries,
        totalAmount: Number(s.total_amount),
        averageAmount: Number(s.average_amount),
        highestAmount: Number(s.highest_amount),
        lowestAmount: Number(s.lowest_amount),
        deletedCount: s.deleted_count ?? 0,
        ...derived,
      });
      setReports({ byCardType, byDay, byCard });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Lightweight refresh — only the aggregated reports + summary. Runs on a
  // timer so charts stay live between user-driven refreshes, and doesn't
  // pay for the full entries download on every tick.
  const refreshReports = useCallback(async () => {
    try {
      const [s, byCardType, byDay, byCard] = await Promise.all([
        getSummary(),
        getByCardType(),
        getByDay(90),
        getByCard(10),
      ]);
      setStats((prev) => ({
        ...prev,
        totalEntries: s.total_entries,
        totalAmount: Number(s.total_amount),
        averageAmount: Number(s.average_amount),
        highestAmount: Number(s.highest_amount),
        lowestAmount: Number(s.lowest_amount),
        deletedCount: s.deleted_count ?? 0,
      }));
      setReports({ byCardType, byDay, byCard });
    } catch {
      /* silent — background tick; a failure toast would be noisy */
    }
  }, []);

  // Refresh everything (summary, charts, data grid).
  const refreshAll = useCallback(() => {
    loadData();
    setRefreshKey((k) => k + 1);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling loop — keeps charts reflecting the live DB without user action.
  useEffect(() => {
    const id = setInterval(refreshReports, REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshReports]);

  const handleDelete = async (id) => {
    try {
      await deleteTransaction(id);
      toast.success("Transaction deleted");
      refreshAll();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleEdit = (entry) => setEditing(entry);

  const handleEditSubmit = async (patch) => {
    if (!editing) return;
    await updateTransaction(editing.id, patch);
    toast.success("Transaction updated");
    refreshAll();
  };

  if (loading && entries.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Loading data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0A0E1A] transition-colors">
      <Navbar username={user?.username ?? "admin"} />

      <main className="p-8 max-w-[1600px] mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Dashboard overview
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-normal mt-1.5 text-sm">
            Manage financial interactions and growth metrics
          </p>
        </header>

        <SummaryPanel stats={stats} />

        <div className="mt-10">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Data injection
            </h3>
            <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Control panel
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <DataInput onDataChanged={refreshAll} />
            </div>
            <div className="lg:col-span-1">
              <DetailedSummary stats={stats} />
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-8">
          <ChartsPanel
            entries={entries}
            byCardType={reports.byCardType}
            byDay={reports.byDay}
          />
          <InsightsPanel
            entries={entries}
            byCard={reports.byCard}
            stats={stats}
          />
          <DataGrid
            onDelete={handleDelete}
            onEdit={handleEdit}
            refreshKey={refreshKey}
          />
        </div>
      </main>

      <EditTransactionModal
        open={!!editing}
        entry={editing}
        onClose={() => setEditing(null)}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}
