import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatApiError, TRIP_COVERS } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Users, MapPin, Calendar, Check, Loader2, PartyPopper } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function JoinTrip() {
  const { token } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/invite/${token}/preview`);
        setPreview(data);
      } catch (err) {
        toast.error("Invalid invite", formatApiError(err));
        nav("/");
      } finally { setLoading(false); }
    })();
  }, [token, nav, toast]);

  useEffect(() => {
    // Persist invite token so that after login/register we can auto-continue
    if (token) sessionStorage.setItem("ts_pending_invite", token);
  }, [token]);

  const accept = async () => {
    if (!user) {
      toast.show({ title: "Sign in to join", description: "Your invite link is saved — after login you'll land right here.", kind: "info" });
      nav("/login");
      return;
    }
    setJoining(true);
    try {
      const { data } = await api.post(`/invite/${token}/accept`);
      setJoined(true);
      sessionStorage.removeItem("ts_pending_invite");
      toast.success(data.status === "joined" ? "You're in!" : "Already a member", "Opening trip…");
      setTimeout(() => nav(`/trip/${data.trip_id}`), 800);
    } catch (err) { toast.error("Failed to join", formatApiError(err)); }
    finally { setJoining(false); }
  };

  if (loading) {
    return <div className="min-h-[100dvh] flex items-center justify-center text-ink-tertiary gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading invite…</div>;
  }
  if (!preview) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg-app" data-testid="join-trip-page">
      <div className="relative h-64 overflow-hidden">
        <img src={TRIP_COVERS[preview.cover_key] || TRIP_COVERS.goa} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-[11px] font-semibold mb-2">
              <PartyPopper className="w-3 h-3" />
              You're invited
            </div>
            <h1 className="font-display text-3xl font-semibold" data-testid="invite-trip-name">{preview.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-90 mt-2">
              {preview.destinations.length > 0 && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{preview.destinations.join(" · ")}</span>}
              {preview.start_date && preview.end_date && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{format(parseISO(preview.start_date), "MMM d")} – {format(parseISO(preview.end_date), "MMM d")}</span>}
              <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{preview.members_count}</span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 flex flex-col">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-5 border border-black/5 mb-6">
          <h2 className="font-display text-xl font-semibold mb-3">What you'll get</h2>
          <ul className="space-y-2 text-sm text-ink-secondary">
            <li className="flex items-start gap-2"><Check className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />Split every expense fairly, automatically</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />Pie chart showing who's spent what</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />AI-powered budget, categories & fun facts</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />One place for all trip tickets & docs</li>
          </ul>
        </motion.div>

        <button
          onClick={accept}
          disabled={joining || joined}
          className="w-full bg-brand text-white font-semibold py-4 rounded-full active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
          data-testid="invite-accept"
        >
          {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : joined ? "Joined ✓" : user ? "Join this trip" : "Sign in to join"}
        </button>
        <button onClick={() => nav("/")} className="text-sm text-ink-secondary font-semibold py-3 mt-2" data-testid="invite-decline">
          Not now
        </button>
        {!user && (
          <p className="text-[11px] text-ink-tertiary text-center mt-4 leading-relaxed">
            New here? We'll save your invite link while you sign up, and open this trip right after.
          </p>
        )}
      </div>
    </div>
  );
}
