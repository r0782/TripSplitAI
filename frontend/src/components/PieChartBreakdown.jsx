import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { fmt } from "../lib/api";

export default function PieChartBreakdown({ data, total, currency = "INR" }) {
  const filtered = data.filter((d) => d.amount > 0);
  if (filtered.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-ink-tertiary text-sm">
        No expenses yet — add your first one to see the split
      </div>
    );
  }
  return (
    <div className="relative h-56" data-testid="pie-chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Pie
            data={filtered}
            dataKey="amount"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={96}
            paddingAngle={2}
            stroke="none"
          >
            {filtered.map((d, i) => <Cell key={i} fill={d.color || "#1A3626"} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">Total spent</div>
        <div className="font-display text-3xl font-bold tabular mt-0.5">{fmt(total, currency)}</div>
      </div>
    </div>
  );
}
