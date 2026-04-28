import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, fmt, TRIP_COVERS, CATEGORIES, formatApiError } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import PieChartBreakdown from "../components/PieChartBreakdown";
import BottomSheet from "../components/BottomSheet";
import AILoading from "../components/AILoading";
import AddExpense from "./AddExpense";
import DocsTab from "../components/DocsTab";
import { ArrowLeft, Plus, Users, Calendar, Scale, Sparkles, Trash2, ChevronRight, MapPin, Share2, Copy, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function TripDetail() {
  const { tripId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [funFacts, setFunFacts] = useState(null);
  const [factsLoading, setFactsLoading] = useState(false);
  const [upiText, setUpiText] = useState("");
  const [showUpi, setShowUpi] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [invite, setInvite] = useState(null);

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get(`/trips/${tripId}`);
      setTrip(data);
    } catch (err) { toast.error("Couldn't load trip", formatApiError(err)); nav("/"); }
    finally { setLoading(false); }
  }, [tripId, nav, toast]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!trip || trip.destinations.length === 0 || funFacts) return;
    (async () => {
      setFactsLoading(true);
      try {
        const { data } = await api.get("/ai/fun-facts", { params: { destination: trip.destinations[0] } });
        setFunFacts(data);
      } catch {} finally { setFactsLoading(false); }
    })();
  }, [trip, funFacts]);

  const openShare = async () => {
    setShowShare(true);
    if (invite) return;
    try {
      const { data } = await api.get(`/trips/${tripId}/invite`);
      setInvite(data);
    } catch (err) { toast.error("Couldn't get invite link", formatApiError(err)); }
  };
  const inviteUrl = invite ? `${window.location.origin}/join/${invite.invite_token}` : "";
  const shareNative = async () => {
    if (!invite) return;
    const url = inviteUrl;
    const title = `Join "${invite.trip_name}" on TripSplit`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Join our trip on TripSplit 🌴`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied", "Paste it in WhatsApp / any chat");
      }
    } catch (e) { /* user cancelled */ }
  };
  const copyLink = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link copied");
    } catch { toast.error("Copy failed"); }
  };
  const rotateInvite = async () => {
    try {
      const { data } = await api.post(`/trips/${tripId}/invite/rotate`);
      setInvite({ ...invite, ...data });
      toast.success("New link generated", "Old link is now invalid");
    } catch (err) { toast.error("Rotate failed", formatApiError(err)); }
  };

  const simulateUpi = async () => {
    if (!upiText.trim()) return;
    try {
      const { data } = await api.post("/ai/smart-notify", { raw_text: upiText });
      toast.ai({
        title: data.suggested_message,
        description: `${data.emoji || "✨"} Category suggestion: ${data.category} · ${fmt(data.amount, data.currency)}`,
        actions: [
          { label: "Edit first", onClick: () => { setUpiText(""); setShowUpi(false); openWithPrefill(data); } },
          { label: "Confirm & add", primary: true, onClick: () => { setUpiText(""); setShowUpi(false); quickAdd(data); } },
        ],
      });
    } catch (err) { toast.error("AI failed", formatApiError(err)); }
  };

  const quickAdd = async (d) => {
    try {
      await api.post(`/trips/${tripId}/expenses`, {
        name: d.merchant,
        amount: d.amount,
        currency: d.currency,
        category: d.category,
        paid_by: trip.members[0].user_id,
        split_among: trip.members.map((m) => m.user_id),
      });
      toast.success("Expense added", `${d.merchant} · ${fmt(d.amount, d.currency)}`);
      reload();
    } catch (err) { toast.error("Add failed", formatApiError(err)); }
  };

  const openWithPrefill = (d) => {
    setShowAdd({ prefill: d });
  };

  const removeExpense = async (expenseId) => {
    try {
      await api.delete(`/trips/${tripId}/expenses/${expenseId}`);
      reload();
    } catch (err) { toast.error("Delete failed", formatApiError(err)); }
  };

  if (loading || !trip) {
    return <div className="min-h-[100dvh] flex items-center justify-center text-ink-tertiary">Loading…</div>;
  }

  const hasExpenses = trip.expenses.length > 0;

  return (
    <div className="min-h-[100dvh] bg-bg-app pb-24" data-testid="trip-detail">
      {/* Hero */}
      <div className="relative h-48 overflow-hidden">
        <img src={TRIP_COVERS[trip.cover_key] || TRIP_COVERS.goa} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-black/25" />
        <button onClick={() => nav("/")} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center active:scale-95" data-testid="trip-back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button onClick={openShare} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center active:scale-95" data-testid="trip-share">
          <Share2 className="w-4 h-4" />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h1 className="font-display text-3xl font-semibold leading-tight" data-testid="trip-name">{trip.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-90 mt-1">
            {trip.destinations.length > 0 && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{trip.destinations.join(" · ")}</span>}
            <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{trip.start_date && format(parseISO(trip.start_date), "MMM d")} – {trip.end_date && format(parseISO(trip.end_date), "MMM d, yyyy")}</span>
            <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{trip.members.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-bg-app/95 backdrop-blur px-5 pt-3 pb-2 border-b border-black/5">
        <div className="inline-flex bg-bg-elevated rounded-full p-1 text-xs font-semibold" data-testid="trip-tabs">
          {[{ k: "overview", label: "Overview" }, { k: "expenses", label: `Expenses` }, { k: "docs", label: "Docs" }, { k: "settle", label: "Settle" }].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`px-3.5 py-1.5 rounded-full transition ${tab === t.k ? "bg-white shadow-sm text-ink-primary" : "text-ink-secondary"}`} data-testid={`tab-${t.k}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5 space-y-5">
        {tab === "overview" && (
          <>
            {/* Pie chart */}
            <div className="bg-white rounded-2xl p-5 shadow-card border border-black/5" data-testid="overview-chart">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-semibold">Who spent what</h3>
                <span className="text-xs text-ink-tertiary tabular">{trip.currency}</span>
              </div>
              <PieChartBreakdown data={trip.per_member_paid.map((m) => ({ name: m.name, amount: m.amount, color: m.color }))} total={trip.total_spent} currency={trip.currency} />
              <div className="mt-3 space-y-1.5">
                {trip.per_member_paid.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between text-sm" data-testid={`member-spend-${m.user_id}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="font-semibold">{m.name}</span>
                    </div>
                    <span className="tabular font-semibold">{fmt(m.amount, trip.currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Balances */}
            <div className="bg-white rounded-2xl p-5 shadow-card border border-black/5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg font-semibold">Balances</h3>
                <button onClick={() => setTab("settle")} className="text-xs font-semibold text-brand inline-flex items-center">Settle <ChevronRight className="w-3 h-3" /></button>
              </div>
              <div className="space-y-2">
                {trip.balances.map((b) => (
                  <div key={b.user_id} className="flex items-center justify-between py-1.5" data-testid={`balance-${b.user_id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: b.color }}>{b.name[0]?.toUpperCase()}</div>
                      <div>
                        <div className="font-semibold text-sm">{b.name}</div>
                        <div className="text-[11px] text-ink-tertiary tabular">Paid {fmt(b.paid, trip.currency)} · Share {fmt(b.share, trip.currency)}</div>
                      </div>
                    </div>
                    <div className={`text-right tabular font-semibold text-sm ${b.net > 0.01 ? "text-success" : b.net < -0.01 ? "text-error" : "text-ink-tertiary"}`}>
                      {b.net > 0.01 ? "+" : ""}{fmt(b.net, trip.currency)}
                      <div className="text-[10px] font-medium uppercase tracking-wider">{b.net > 0.01 ? "Gets back" : b.net < -0.01 ? "Owes" : "Settled"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulate UPI */}
            <button onClick={() => setShowUpi(true)} className="w-full ai-border rounded-2xl bg-magic-light/30 p-4 flex items-center gap-3 active:scale-[0.98] transition" data-testid="simulate-upi-btn">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-magic"><Sparkles className="w-5 h-5" /></div>
              <div className="text-left flex-1">
                <div className="font-semibold text-sm">Simulate UPI payment</div>
                <div className="text-xs text-ink-secondary">AI will classify and auto-add as an expense</div>
              </div>
              <ChevronRight className="w-4 h-4 text-magic" />
            </button>

            {/* Fun Facts */}
            {trip.destinations.length > 0 && (
              <div data-testid="fun-facts">
                <h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-magic" />
                  Fun facts — {funFacts?.destination || trip.destinations[0]}
                </h3>
                {factsLoading && <AILoading label="Loading fun facts" />}
                {funFacts && (
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar scroll-snap-x pb-2 -mx-5 px-5">
                    {funFacts.facts?.map((f, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="flex-shrink-0 w-[240px] bg-white rounded-2xl p-4 border border-black/5 shadow-card">
                        <div className="text-2xl mb-2">{f.emoji}</div>
                        <div className="font-semibold text-sm">{f.title}</div>
                        <div className="text-xs text-ink-secondary mt-1 leading-relaxed">{f.text}</div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "expenses" && (
          <div className="space-y-2" data-testid="expenses-list">
            {!hasExpenses && (
              <div className="bg-white rounded-2xl p-8 text-center border border-black/5">
                <div className="text-ink-tertiary text-sm">No expenses yet. Tap + to add one.</div>
              </div>
            )}
            {trip.expenses.map((e) => {
              const cat = CATEGORIES.find((c) => c.id === e.category) || CATEGORIES[5];
              const payer = trip.members.find((m) => m.user_id === e.paid_by);
              return (
                <div key={e.expense_id} className="bg-white rounded-2xl p-4 border border-black/5 flex items-center gap-3 shadow-card" data-testid={`expense-${e.expense_id}`}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0" style={{ backgroundColor: cat.color }}>{cat.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{e.name}</div>
                    <div className="text-[11px] text-ink-tertiary">
                      {payer?.name} paid · {format(parseISO(e.paid_at), "MMM d, h:mm a")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular font-semibold">{fmt(e.amount, e.currency)}</div>
                    {e.currency !== trip.currency && (
                      <div className="text-[10px] text-ink-tertiary tabular">≈ {fmt(e.amount_home, trip.currency)}</div>
                    )}
                  </div>
                  <button onClick={() => removeExpense(e.expense_id)} className="text-ink-tertiary p-1" data-testid={`del-${e.expense_id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "docs" && <DocsTab trip={trip} />}

        {tab === "settle" && <SettleView tripId={tripId} />}
      </div>

      {/* FAB */}
      <button onClick={() => setShowAdd(true)} className="fixed bottom-6 right-6 sm:right-[calc(50%-215px+24px)] z-40 w-14 h-14 bg-brand rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition" data-testid="fab-add-expense">
        <Plus className="w-6 h-6" />
      </button>

      {/* Add expense sheet */}
      <BottomSheet open={!!showAdd} onClose={() => setShowAdd(false)} title="Add expense" testId="add-expense-sheet">
        {!!showAdd && <AddExpense trip={trip} prefill={showAdd.prefill} onDone={() => { setShowAdd(false); reload(); }} />}
      </BottomSheet>

      {/* Simulate UPI sheet */}
      <BottomSheet open={showUpi} onClose={() => setShowUpi(false)} title="Simulate UPI notification" testId="upi-sheet">
        <p className="text-sm text-ink-secondary mb-3">Paste a notification-style text — AI will classify the merchant, amount and category.</p>
        <textarea value={upiText} onChange={(e) => setUpiText(e.target.value)} rows={3} placeholder="Paid ₹850 to Swiggy via GPay"
          className="w-full bg-white border border-black/10 rounded-2xl p-3 outline-none focus:border-brand text-sm" data-testid="upi-text" />
        <div className="flex flex-wrap gap-2 mt-3">
          {["Paid ₹850 to Swiggy via GPay", "₹1,200 paid to Uber India", "Starbucks Mumbai ₹420 via PayTM", "₹3,500 for Resort Booking Makemytrip"].map((s) => (
            <button key={s} onClick={() => setUpiText(s)} className="text-[11px] bg-bg-elevated px-3 py-1.5 rounded-full">{s}</button>
          ))}
        </div>
        <button onClick={simulateUpi} disabled={!upiText.trim()} className="w-full mt-4 bg-magic text-white font-semibold py-3 rounded-full active:scale-[0.98] transition disabled:opacity-60" data-testid="upi-simulate">
          ✨ Ask AI
        </button>
      </BottomSheet>

      {/* Share invite sheet */}
      <BottomSheet open={showShare} onClose={() => setShowShare(false)} title="Invite friends" testId="share-sheet">
        <p className="text-sm text-ink-secondary mb-4">Anyone with this link can join the trip and see/add expenses. You can rotate the link anytime.</p>
        {!invite ? (
          <div className="text-ink-tertiary text-sm">Generating link…</div>
        ) : (
          <>
            <div className="bg-bg-elevated rounded-2xl p-3 mb-3 flex items-center gap-2">
              <div className="flex-1 text-xs font-mono truncate text-ink-primary" data-testid="invite-url">{inviteUrl}</div>
              <button onClick={copyLink} className="w-8 h-8 rounded-full bg-white flex items-center justify-center active:scale-95" data-testid="invite-copy">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <button onClick={shareNative} className="w-full bg-brand text-white font-semibold py-3 rounded-full active:scale-[0.98] transition flex items-center justify-center gap-2" data-testid="invite-share">
              <Share2 className="w-4 h-4" /> Share link
            </button>
            <button onClick={rotateInvite} className="w-full mt-2 text-sm font-semibold text-ink-secondary py-2 flex items-center justify-center gap-2" data-testid="invite-rotate">
              <RefreshCw className="w-3.5 h-3.5" /> Generate new link
            </button>
          </>
        )}
      </BottomSheet>
    </div>
  );
}

function SettleView({ tripId }) {
  const [settle, setSettle] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const reload = useCallback(async () => {
    try {
      const { data } = await api.get(`/trips/${tripId}/settlement`);
      setSettle(data);
    } finally { setLoading(false); }
  }, [tripId]);
  useEffect(() => { reload(); }, [reload]);

  const markSettled = async (txn) => {
    try {
      await api.post(`/trips/${tripId}/settle`, { from_user: txn.from_user_id, to_user: txn.to_user_id, amount: txn.amount });
      toast.success("Settlement recorded", `${txn.from_name} paid ${txn.to_name}`);
      reload();
    } catch (err) { toast.error("Failed", formatApiError(err)); }
  };

  if (loading) return <div className="text-ink-tertiary text-sm">Loading…</div>;
  const txns = settle?.transactions || [];
  return (
    <div className="space-y-3" data-testid="settle-view">
      <div className="bg-white rounded-2xl p-4 border border-black/5">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4 text-brand" />
          <h3 className="font-display text-lg font-semibold">Simplified debts</h3>
        </div>
        {txns.length === 0 ? (
          <div className="text-sm text-ink-tertiary">All settled up ✨</div>
        ) : (
          <div className="space-y-2">
            {txns.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3 bg-bg-elevated rounded-2xl p-3" data-testid={`txn-${i}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-semibold text-sm truncate">{t.from_name}</span>
                  <span className="text-ink-tertiary">→</span>
                  <span className="font-semibold text-sm truncate">{t.to_name}</span>
                </div>
                <div className="tabular font-semibold">{fmt(t.amount, settle.currency)}</div>
                <button onClick={() => markSettled(t)} className="text-xs font-semibold bg-brand text-white px-3 py-1.5 rounded-full" data-testid={`settle-${i}`}>
                  Mark paid
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
