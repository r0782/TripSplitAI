import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, fmt, CATEGORIES, formatApiError } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { Sparkles, Check } from "lucide-react";

export default function AddExpense({ trip, prefill, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: prefill?.merchant || "",
    amount: prefill?.amount ? String(prefill.amount) : "",
    currency: prefill?.currency || trip.currency,
    category: prefill?.category || "Other",
    paid_by: trip.members[0].user_id,
    split_among: trip.members.map((m) => m.user_id),
  });
  const [aiSuggest, setAiSuggest] = useState(prefill ? { category: prefill.category, emoji: "✨", confidence: 0.9 } : null);
  const [saving, setSaving] = useState(false);
  const [converted, setConverted] = useState(null);
  const debounceRef = useRef(null);

  // Auto-categorize on name change (debounced)
  useEffect(() => {
    if (!form.name.trim() || form.name.length < 3) { setAiSuggest(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post("/ai/categorize", { name: form.name });
        setAiSuggest(data);
      } catch {}
    }, 700);
    return () => clearTimeout(debounceRef.current);
  }, [form.name]);

  // Currency conversion preview
  useEffect(() => {
    const amt = parseFloat(form.amount);
    if (!amt || form.currency === trip.currency) { setConverted(null); return; }
    (async () => {
      try {
        const { data } = await api.get(`/fx/${form.currency}/${trip.currency}`, { params: { amount: amt } });
        setConverted(data.converted);
      } catch {}
    })();
  }, [form.amount, form.currency, trip.currency]);

  const toggleSplit = (uid) => {
    const set = new Set(form.split_among);
    if (set.has(uid)) set.delete(uid); else set.add(uid);
    if (set.size === 0) return;
    setForm({ ...form, split_among: Array.from(set) });
  };

  const save = async () => {
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || !amount || amount <= 0) return toast.error("Name and amount required");
    setSaving(true);
    try {
      await api.post(`/trips/${trip.trip_id}/expenses`, {
        name: form.name,
        amount,
        currency: form.currency,
        category: form.category,
        paid_by: form.paid_by,
        split_among: form.split_among,
      });
      toast.success("Expense added", `${form.name} · ${fmt(amount, form.currency)}`);
      onDone?.();
    } catch (err) { toast.error("Failed", formatApiError(err)); }
    finally { setSaving(false); }
  };

  const applyAi = () => {
    if (!aiSuggest) return;
    setForm({ ...form, category: aiSuggest.category });
  };

  return (
    <div className="space-y-4" data-testid="add-expense-form">
      {prefill && (
        <div className="ai-border bg-magic-light/50 rounded-2xl p-3 flex items-center gap-2 text-sm" data-testid="prefill-notice">
          <Sparkles className="w-4 h-4 text-magic" />
          <span>AI pre-filled from UPI simulation — tweak and save</span>
        </div>
      )}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">What was it for?</label>
        <div className="relative">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Dinner at Fisherman's Wharf"
            className="w-full bg-white border border-black/10 rounded-2xl px-4 py-3.5 mt-1.5 outline-none focus:border-brand pr-28" data-testid="exp-name" />
          <AnimatePresence>
            {aiSuggest && aiSuggest.category && (
              <motion.button
                key={aiSuggest.category}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                onClick={applyAi}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 mt-0.5 bg-magic-light text-magic text-[11px] font-bold px-2.5 py-1.5 rounded-full inline-flex items-center gap-1 border border-magic/30"
                data-testid="ai-category-chip"
              >
                {aiSuggest.emoji} {aiSuggest.category}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Amount</label>
          <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
            className="w-full bg-white border border-black/10 rounded-2xl px-4 py-3.5 mt-1.5 outline-none focus:border-brand tabular" data-testid="exp-amount" />
          {converted !== null && (
            <div className="text-[11px] text-ink-tertiary mt-1 tabular">
              ≈ {fmt(converted, trip.currency)} in trip currency
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Currency</label>
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full bg-white border border-black/10 rounded-2xl px-3 py-3.5 mt-1.5 outline-none focus:border-brand tabular text-sm" data-testid="exp-currency">
            <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option>
            <option>JPY</option><option>AED</option><option>SGD</option><option>THB</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Category</label>
        <div className="grid grid-cols-3 gap-2 mt-1.5">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setForm({ ...form, category: c.id })}
              className={`flex flex-col items-center py-2.5 rounded-2xl border-2 transition ${form.category === c.id ? "border-brand bg-bg-elevated" : "border-transparent bg-white"}`}
              data-testid={`cat-${c.id}`}>
              <span className="text-xl">{c.emoji}</span>
              <span className="text-[11px] font-semibold mt-0.5">{c.id}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Paid by</label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {trip.members.map((m) => (
            <button key={m.user_id} onClick={() => setForm({ ...form, paid_by: m.user_id })}
              className={`px-3.5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2 ${form.paid_by === m.user_id ? "bg-brand text-white" : "bg-white border border-black/10 text-ink-primary"}`}
              data-testid={`payer-${m.user_id}`}>
              <span className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center" style={{ backgroundColor: form.paid_by === m.user_id ? "rgba(255,255,255,0.2)" : m.color, color: "white" }}>
                {m.name[0]}
              </span>
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Split among</label>
        <div className="space-y-1.5 mt-1.5">
          {trip.members.map((m) => {
            const on = form.split_among.includes(m.user_id);
            return (
              <button key={m.user_id} onClick={() => toggleSplit(m.user_id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition ${on ? "bg-bg-elevated" : "bg-white border border-black/10 opacity-50"}`}
                data-testid={`split-${m.user_id}`}>
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: on ? m.color : "transparent", border: on ? "none" : "1.5px solid #d4d4d4" }}>
                  {on && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className="flex-1 text-left font-semibold text-sm">{m.name}</div>
                {on && form.amount && (
                  <div className="text-xs text-ink-tertiary tabular">
                    {fmt(parseFloat(form.amount) / form.split_among.length, form.currency)}/each
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="w-full bg-brand text-white font-semibold py-3.5 rounded-full active:scale-[0.98] transition disabled:opacity-60 mt-2" data-testid="exp-save">
        {saving ? "Saving…" : "Add expense"}
      </button>
    </div>
  );
}
