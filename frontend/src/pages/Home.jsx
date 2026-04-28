import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, fmt, TRIP_COVERS } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import BottomNav from "../components/BottomNav";
import { Plane, Users, MapPin, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function Home() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/trips");
        setTrips(data);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="min-h-[100dvh] pb-28" data-testid="home-page">
      <div className="px-5 pt-8 pb-5">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-ink-tertiary">Welcome back</p>
            <h1 className="font-display text-3xl font-semibold text-ink-primary leading-tight mt-1">Hey {user?.name?.split(" ")[0] || "Traveler"} 👋</h1>
          </div>
          <button onClick={() => nav("/profile")} className="w-11 h-11 rounded-full bg-brand text-white font-semibold flex items-center justify-center active:scale-95 transition" data-testid="home-avatar">
            {user?.picture ? <img src={user.picture} alt="" className="w-full h-full rounded-full object-cover" /> : (user?.name?.[0] || "T").toUpperCase()}
          </button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="ai-border rounded-2xl bg-magic-light/50 p-4 flex items-start gap-3 relative overflow-hidden"
          data-testid="ai-hint"
        >
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-magic flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm">Plan your next adventure</div>
            <div className="text-xs text-ink-secondary mt-0.5">Tell me where you're going — I'll estimate the budget in seconds.</div>
          </div>
        </motion.div>
      </div>

      <div className="px-5 flex items-center justify-between mb-3">
        <h2 className="font-display text-xl font-semibold">Your trips</h2>
        {trips.length > 0 && <span className="text-xs text-ink-tertiary font-semibold">{trips.length} active</span>}
      </div>

      {loading ? (
        <div className="px-5 space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-40 rounded-2xl bg-white animate-pulse" />)}
        </div>
      ) : trips.length === 0 ? (
        <div className="px-5">
          <div className="bg-white rounded-2xl p-6 text-center border border-black/5" data-testid="empty-trips">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-bg-elevated flex items-center justify-center mb-3">
              <Plane className="w-6 h-6 text-brand" />
            </div>
            <h3 className="font-display text-lg font-semibold">No trips yet</h3>
            <p className="text-ink-secondary text-sm mt-1">Tap the + button to create your first trip and let AI estimate the budget.</p>
            <button onClick={() => nav("/create")} className="mt-4 bg-brand text-white font-semibold px-6 py-2.5 rounded-full text-sm" data-testid="empty-create">
              Create a trip
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 space-y-3" data-testid="trips-list">
          {trips.map((t, i) => (
            <motion.div
              key={t.trip_id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => nav(`/trip/${t.trip_id}`)}
              className="relative rounded-2xl overflow-hidden bg-white shadow-card border border-black/5 active:scale-[0.98] transition cursor-pointer"
              data-testid={`trip-card-${t.trip_id}`}
            >
              <div className="h-28 relative overflow-hidden">
                <img
                  src={TRIP_COVERS[t.cover_key] || TRIP_COVERS.goa}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute bottom-2.5 left-3.5 right-3.5 text-white">
                  <div className="font-display text-lg font-semibold leading-tight">{t.name}</div>
                  <div className="flex items-center gap-3 text-[11px] opacity-90 mt-0.5">
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{t.destinations.slice(0, 2).join(" • ") || "No places yet"}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-ink-secondary">
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{t.members?.length || 1}</span>
                  {t.start_date && <span>{format(parseISO(t.start_date), "MMM d")} – {t.end_date && format(parseISO(t.end_date), "MMM d")}</span>}
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-tertiary">Total</div>
                  <div className="font-display text-base font-semibold tabular">{fmt(t.total_spent || 0, t.currency)}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <BottomNav onCreate={() => nav("/create")} />
    </div>
  );
}
