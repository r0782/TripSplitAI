import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmt, CATEGORIES } from "../lib/api";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../contexts/AuthContext";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp, Plane } from "lucide-react";

export default function Insights() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: list } = await api.get("/trips");
        const full = await Promise.all(list.map((t) => api.get(`/trips/${t.trip_id}`).then((r) => r.data)));
        setTrips(full);
      } finally { setLoading(false); }
    })();
  }, []);

  const totalSpent = trips.reduce((s, t) => s + (t.total_spent || 0), 0);
  const byCategory = {};
  trips.forEach((t) => (t.per_category || []).forEach((c) => { byCategory[c.category] = (byCategory[c.category] || 0) + c.amount; }));
  const catData = Object.entries(byCategory).map(([category, amount]) => ({
    name: category,
    amount: Math.round(amount),
    color: (CATEGORIES.find((c) => c.id === category) || CATEGORIES[5]).color,
  }));

  const tripBars = trips.map((t) => ({ name: t.name.slice(0, 10), amount: Math.round(t.total_spent || 0), color: "#1A3626" }));

  return (
    <div className="min-h-[100dvh] pb-28 bg-bg-app" data-testid="insights-page">
      <div className="px-5 pt-8">
        <p className="text-xs uppercase tracking-wider font-semibold text-ink-tertiary">Insights</p>
        <h1 className="font-display text-3xl font-semibold mt-1">Your travel money</h1>
      </div>
      {loading ? (
        <div className="px-5 mt-5 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-white animate-pulse" />)}
        </div>
      ) : trips.length === 0 ? (
        <div className="px-5 mt-5">
          <div className="bg-white rounded-2xl p-6 text-center border border-black/5">
            <Plane className="w-8 h-8 text-brand mx-auto mb-2" />
            <div className="font-semibold">No data yet</div>
            <div className="text-xs text-ink-secondary">Create a trip and log expenses to see insights.</div>
          </div>
        </div>
      ) : (
        <div className="px-5 mt-5 space-y-4">
          <div className="bg-brand text-white rounded-2xl p-5">
            <div className="text-xs uppercase tracking-widest font-semibold opacity-70">Lifetime spent</div>
            <div className="font-display text-4xl font-bold tabular mt-1">{fmt(totalSpent, user?.home_currency || "INR")}</div>
            <div className="text-xs opacity-70 mt-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" />{trips.length} {trips.length === 1 ? "trip" : "trips"} · {trips.reduce((s, t) => s + (t.expenses?.length || 0), 0)} expenses</div>
          </div>

          {catData.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-black/5" data-testid="category-breakdown">
              <h3 className="font-display text-lg font-semibold mb-2">By category</h3>
              <div className="h-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={catData} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
                      {catData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-2 text-xs">
                {catData.map((c) => (
                  <div key={c.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-ink-secondary">{c.name}</span>
                    <span className="font-semibold tabular ml-auto">{fmt(c.amount, user?.home_currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tripBars.length > 1 && (
            <div className="bg-white rounded-2xl p-5 border border-black/5" data-testid="trips-bar">
              <h3 className="font-display text-lg font-semibold mb-2">Per trip</h3>
              <div className="h-44">
                <ResponsiveContainer>
                  <BarChart data={tripBars} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={36} />
                    <Tooltip cursor={{ fill: "rgba(26,54,38,0.05)" }} />
                    <Bar dataKey="amount" fill="#1A3626" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-display text-lg font-semibold">Trips</h3>
            {trips.map((t) => (
              <button key={t.trip_id} onClick={() => nav(`/trip/${t.trip_id}`)} className="w-full bg-white rounded-2xl p-4 border border-black/5 flex items-center justify-between text-left active:scale-[0.98] transition" data-testid={`insight-trip-${t.trip_id}`}>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-ink-tertiary">{t.members.length} members · {t.expenses?.length || 0} expenses</div>
                </div>
                <div className="tabular font-semibold text-sm">{fmt(t.total_spent || 0, t.currency)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      <BottomNav onCreate={() => nav("/create")} />
    </div>
  );
}
