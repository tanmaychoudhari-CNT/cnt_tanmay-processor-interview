// Three charts in a row: trend (area), distribution (bar), brand mix (donut).
//
// Prefers server aggregates (`byDay`, `byCardType`) over re-aggregating the
// entries list — entries is capped at 10k rows so distribution-over-time
// charts would be wrong on a larger dataset. We fall back to client-side
// derivation only while reports are in flight.

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList,
  PieChart,
  Pie,
} from "recharts";

// Brand palette kept in sync with CardBrandLogo.
const BRAND_COLORS = {
  Visa: "#1A1F71",
  MasterCard: "#EB001B",
  Amex: "#006FCF",
  Discover: "#FF6000",
  Unknown: "#9CA3AF",
};

export default function ChartsPanel({ entries, byCardType = [], byDay = [] }) {
  // Trend: prefer the server's /reports/by-day aggregation (full dataset).
  // Fall back to deriving from entries only if reports haven't loaded yet.
  const trendData = useMemo(() => {
    if (byDay.length) {
      return byDay
        .slice()
        .sort((a, b) => String(a.day).localeCompare(String(b.day)))
        .map((d) => ({
          time: new Date(d.day).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
          }),
          amount: Number(d.total_amount ?? 0),
        }));
    }
    const map = new Map();
    for (const e of entries) {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + Number(e.amount));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, total]) => ({
        time: new Date(day).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
        }),
        amount: Number(total.toFixed(2)),
      }));
  }, [entries, byDay]);

  const amountRanges = useMemo(() => {
    // Finer-grained buckets so the shape of the distribution is visible rather
    // than collapsed into four coarse bins.
    const buckets = [
      { name: "$0-100", min: 0, max: 100, count: 0, total: 0 },
      { name: "$100-500", min: 100, max: 500, count: 0, total: 0 },
      { name: "$500-1k", min: 500, max: 1000, count: 0, total: 0 },
      { name: "$1k-2.5k", min: 1000, max: 2500, count: 0, total: 0 },
      { name: "$2.5k-5k", min: 2500, max: 5000, count: 0, total: 0 },
      { name: "$5k-10k", min: 5000, max: 10000, count: 0, total: 0 },
      { name: "$10k+", min: 10000, max: Infinity, count: 0, total: 0 },
    ];
    for (const e of entries) {
      const v = Math.abs(Number(e.amount));
      const bucket = buckets.find((r) => v >= r.min && v < r.max);
      if (bucket) {
        bucket.count += 1;
        bucket.total += v;
      }
    }
    return buckets;
  }, [entries]);

  // Summary metrics under the distribution chart — quick-read stats so the
  // chart isn't just a shape, it tells a story.
  const distributionMeta = useMemo(() => {
    const totalCount = amountRanges.reduce((s, b) => s + b.count, 0);
    const biggest = amountRanges.reduce(
      (a, b) => (b.count > a.count ? b : a),
      amountRanges[0]
    );
    const totalAmount = amountRanges.reduce((s, b) => s + b.total, 0);
    const avg = totalCount ? totalAmount / totalCount : 0;
    return {
      totalCount,
      biggestBucket: biggest?.count > 0 ? biggest.name : "—",
      biggestShare: totalCount
        ? Math.round(((biggest?.count ?? 0) / totalCount) * 100)
        : 0,
      avg,
    };
  }, [amountRanges]);

  // Brand mix — use the server's /reports/by-card-type aggregation so the
  // chart reflects the ENTIRE dataset, not just the 10k-row entries window.
  // Fall back to deriving from entries only while the report is in flight.
  const brandData = useMemo(() => {
    if (byCardType.length) {
      return byCardType
        .map((b) => ({ name: b.card_type || "Unknown", value: b.count }))
        .sort((a, b) => b.value - a.value);
    }
    const counts = {};
    for (const e of entries) {
      const key = e.cardType || "Unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [entries, byCardType]);

  const totalBrandCount = brandData.reduce((s, b) => s + b.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50">Financial trends</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-1">
              Movement analysis
            </p>
          </div>
          <div className="px-3 py-1 bg-accent/10 text-accent text-[10px] font-medium uppercase tracking-wider rounded-full">
            Real-time
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A0DD" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00A0DD" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 500 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 500 }}
                tickFormatter={(val) =>
                  Math.abs(val) >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val}`
                }
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  padding: "12px",
                }}
                formatter={(v) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(v)
                }
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#00A0DD"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAmount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Distribution
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-1">
              Amount segmentation
            </p>
          </div>
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
            {distributionMeta.totalCount.toLocaleString("en-US")} total
          </span>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={amountRanges}
              barCategoryGap="22%"
              margin={{ top: 18, right: 8, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00A0DD" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#00A0DD" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 500 }}
                interval={0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 500 }}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "#f9fafb" }}
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  padding: "12px",
                }}
                formatter={(_value, _name, props) => {
                  const { count, total } = props.payload;
                  const share = distributionMeta.totalCount
                    ? Math.round((count / distributionMeta.totalCount) * 100)
                    : 0;
                  const money = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(total);
                  return [`${count} tx · ${share}% · ${money}`, "Transactions"];
                }}
              />
              <Bar
                dataKey="count"
                radius={[8, 8, 0, 0]}
                maxBarSize={36}
                fill="url(#barFill)"
              >
                <LabelList
                  dataKey="count"
                  position="top"
                  formatter={(v) => (v > 0 ? v : "")}
                  style={{ fontSize: 11, fontWeight: 600, fill: "#374151" }}
                />
                {amountRanges.map((b) => (
                  <Cell
                    key={b.name}
                    // Highlight the modal bucket; fade empty ones.
                    fillOpacity={
                      b.count === 0 ? 0.2 : b.name === distributionMeta.biggestBucket ? 1 : 0.75
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Inline summary row — turns the chart into a quick-read insight. */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Largest bucket
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 mt-0.5 tabular-nums">
              {distributionMeta.biggestBucket}{" "}
              <span className="text-gray-400 dark:text-gray-500 font-normal">
                · {distributionMeta.biggestShare}%
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Avg transaction
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 mt-0.5 tabular-nums">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(distributionMeta.avg)}
            </p>
          </div>
        </div>
      </div>

      {/* Brand mix — donut showing share of transactions per card brand. */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Brand mix
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-1">
              Share by card type
            </p>
          </div>
        </div>

        <div className="h-64 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  padding: "12px",
                }}
              />
              <Pie
                data={brandData}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="85%"
                paddingAngle={2}
                stroke="none"
              >
                {brandData.map((d) => (
                  <Cell key={d.name} fill={BRAND_COLORS[d.name] ?? "#9CA3AF"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center label — total transactions in this slice of time. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-gray-900 dark:text-gray-50 tracking-tight tabular-nums">
              {totalBrandCount.toLocaleString("en-US")}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-1">
              Transactions
            </span>
          </div>
        </div>

        {/* Legend — compact color dot + brand name + count. */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          {brandData.map((b) => (
            <div
              key={b.name}
              className="flex items-center gap-2 text-[12px] font-normal text-gray-600 dark:text-gray-300"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: BRAND_COLORS[b.name] ?? "#9CA3AF" }}
              />
              <span className="text-gray-800 dark:text-gray-100">{b.name}</span>
              <span className="ml-auto tabular-nums text-gray-400 dark:text-gray-500">
                {b.value.toLocaleString("en-US")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
