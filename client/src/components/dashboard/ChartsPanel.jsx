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
} from "recharts";

export default function ChartsPanel({ entries }) {
  const trendData = useMemo(() => {
    const byDay = new Map();
    for (const e of entries) {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      byDay.set(key, (byDay.get(key) || 0) + Number(e.amount));
    }
    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, total]) => ({
        time: new Date(day).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
        }),
        amount: Number(total.toFixed(2)),
      }));
  }, [entries]);

  const amountRanges = useMemo(() => {
    const buckets = [
      { name: "0-500", min: 0, max: 500, count: 0 },
      { name: "500-1k", min: 500, max: 1000, count: 0 },
      { name: "1k-5k", min: 1000, max: 5000, count: 0 },
      { name: "5k+", min: 5000, max: Infinity, count: 0 },
    ];
    for (const e of entries) {
      const v = Math.abs(Number(e.amount));
      const bucket = buckets.find((r) => v >= r.min && v < r.max);
      if (bucket) bucket.count += 1;
    }
    return buckets;
  }, [entries]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-gray-900">Financial trends</h3>
            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mt-1">
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

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-gray-900">Distribution</h3>
            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider mt-1">
              Amount segmentation
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={amountRanges} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 500 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 500 }}
              />
              <Tooltip
                cursor={{ fill: "#f9fafb" }}
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  padding: "12px",
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={40}>
                {amountRanges.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index % 2 === 0 ? "#141414" : "#00A0DD"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
