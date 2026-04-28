import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, formatApiError, COVER_OPTIONS, fmt } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import AILoading from "../components/AILoading";
import { ArrowLeft, Plus, X, Sparkles, Calendar, Users, MapPin, Check } from "lucide-react";

export default function CreateTrip() {
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    destinations: [],
    destInput: "",
    start_date: "",
    end_date: "",
    currency: user?.home_currency || "INR",
    members: [],
    memberInput: "",
    cover_key: "goa",
    travel_style: "mid-range",
  });
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);

  const addDest = () => {
    const v = form.destInput.trim();
    if (!v) return;
    setForm({ ...form, destinations: [...form.destinations, v], destInput: "" });
  };
  const removeDest = (i) => setForm({ ...form, destinations: form.destinations.filter((_, x) => x !== i) });
  const addMember = () => {
    const v = form.memberInput.trim();
    if (!v) return;
    setForm({ ...form, members: [...form.members, v], memberInput: "" });
  };
  const removeMember = (i) => setForm({ ...form, members: form.members.filter((_, x) => x !== i) });

  const days = form.start_date && form.end_date
    ? Math.max(1, Math.round((new Date(form.end_date) - new Date(form.start_date)) / (1000 * 60 * 60 * 24)) + 1)
    : 1;
  const peopleCount = (form.members.length || 0) + 1;

  const runEstimate = async () => {
    if (form.destinations.length === 0) return toast.error("Add at least one destination first");
    setEstimating(true);
    setEstimate(null);
    try {
      const { data } = await api.post("/ai/budget-estimate", {
        destinations: form.destinations,
        days,
        people: peopleCount,
        currency: form.currency,
        travel_style: form.travel_style,
      });
      setEstimate(data);
    } catch (err) { toast.error("AI estimate failed", formatApiError(err)); }
    finally { setEstimating(false); }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Trip name required");
    if (!form.start_date || !form.end_date) return toast.error("Add dates");
    setSaving(true);
    try {
      const { data } = await api.post("/trips", {
        name: form.name,
        destinations: form.destinations,
        start_date: form.start_date,
        end_date: form.end_date,
        currency: form.currency,
        member_names: form.members,
        cover_key: form.cover_key,
      });
      toast.success("Trip created", "Start adding expenses 🎉");
      nav(`/trip/${data.trip_id}`);
    } catch (err) { toast.error("Create failed", formatApiError(err)); }
    finally { setSaving(false); }
  };

  const stepComplete = {
    1: form.name.trim() && form.start_date && form.end_date && form.destinations.length > 0,
    2: true, // members optional
    3: true,
  };

  return (
    <div className="min-h-[100dvh] bg-bg-app pb-8" data-testid="create-trip-page">
      <div className="sticky top-0 z-10 bg-bg-app/90 backdrop-blur px-5 py-4 flex items-center gap-3 border-b border-black/5">
        <button onClick={() => step === 1 ? nav(-1) : setStep(step - 1)} className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-95" data-testid="create-back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-ink-tertiary">Step {step} of 3</div>
          <h1 className="font-display text-lg font-semibold">
            {step === 1 && "Trip basics"}
            {step === 2 && "Who's coming"}
            {step === 3 && "AI budget & confirm"}
          </h1>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => <div key={s} className={`h-1 w-6 rounded-full ${s <= step ? "bg-brand" : "bg-black/10"}`} />)}
        </div>
      </div>

      <div className="px-5 py-6 space-y-5">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Trip name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Goa with the crew"
                  className="w-full bg-white border border-black/10 rounded-2xl px-4 py-3.5 mt-1.5 outline-none focus:border-brand"
                  data-testid="create-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary flex items-center gap-1"><Calendar className="w-3 h-3" />Start</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full bg-white border border-black/10 rounded-2xl px-3 py-3.5 mt-1.5 outline-none focus:border-brand" data-testid="create-start" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary flex items-center gap-1"><Calendar className="w-3 h-3" />End</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full bg-white border border-black/10 rounded-2xl px-3 py-3.5 mt-1.5 outline-none focus:border-brand" data-testid="create-end" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary flex items-center gap-1"><MapPin className="w-3 h-3" />Destinations</label>
                <div className="flex gap-2 mt-1.5">
                  <input value={form.destInput} onChange={(e) => setForm({ ...form, destInput: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDest(); } }}
                    placeholder="e.g. Anjuna, Panjim"
                    className="flex-1 bg-white border border-black/10 rounded-2xl px-4 py-3.5 outline-none focus:border-brand" data-testid="create-dest-input" />
                  <button onClick={addDest} className="bg-brand text-white w-12 rounded-2xl active:scale-95" data-testid="create-dest-add">
                    <Plus className="w-4 h-4 mx-auto" />
                  </button>
                </div>
                {form.destinations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3" data-testid="dest-chips">
                    {form.destinations.map((d, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-brand text-white px-3 py-1.5 rounded-full text-sm">
                        {d}
                        <button onClick={() => removeDest(i)} className="opacity-70 hover:opacity-100"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Trip currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full bg-white border border-black/10 rounded-2xl px-4 py-3.5 mt-1.5 outline-none focus:border-brand" data-testid="create-currency">
                  <option value="INR">₹ INR — India</option>
                  <option value="USD">$ USD — United States</option>
                  <option value="EUR">€ EUR — Eurozone</option>
                  <option value="GBP">£ GBP — United Kingdom</option>
                  <option value="JPY">¥ JPY — Japan</option>
                  <option value="THB">฿ THB — Thailand</option>
                  <option value="AED">د.إ AED — UAE</option>
                  <option value="SGD">S$ SGD — Singapore</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Vibe / cover</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {COVER_OPTIONS.map((c) => (
                    <button key={c.key} onClick={() => setForm({ ...form, cover_key: c.key })}
                      className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition ${form.cover_key === c.key ? "border-brand" : "border-transparent opacity-75"}`}
                      data-testid={`cover-${c.key}`}>
                      <img src={c.url} alt={c.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-[10px] text-center py-0.5">{c.label}</div>
                      {form.cover_key === c.key && <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand flex items-center justify-center text-white"><Check className="w-3 h-3" /></div>}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-5">
              <div className="bg-white rounded-2xl p-4 border border-black/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand text-white font-semibold rounded-full flex items-center justify-center">{user?.name?.[0] || "T"}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{user?.name} <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-tertiary ml-1">You</span></div>
                    <div className="text-xs text-ink-secondary">{user?.email}</div>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary flex items-center gap-1"><Users className="w-3 h-3" />Add members</label>
                <div className="flex gap-2 mt-1.5">
                  <input value={form.memberInput} onChange={(e) => setForm({ ...form, memberInput: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMember(); } }}
                    placeholder="Name"
                    className="flex-1 bg-white border border-black/10 rounded-2xl px-4 py-3.5 outline-none focus:border-brand" data-testid="member-input" />
                  <button onClick={addMember} className="bg-brand text-white w-12 rounded-2xl active:scale-95" data-testid="member-add">
                    <Plus className="w-4 h-4 mx-auto" />
                  </button>
                </div>
                {form.members.length > 0 && (
                  <div className="mt-3 space-y-2" data-testid="member-list">
                    {form.members.map((m, i) => (
                      <div key={i} className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between border border-black/5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-bg-elevated rounded-full flex items-center justify-center font-semibold text-ink-secondary">{m[0]?.toUpperCase()}</div>
                          <div className="font-semibold">{m}</div>
                        </div>
                        <button onClick={() => removeMember(i)} className="text-ink-tertiary p-1"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-xs text-ink-tertiary mt-3">You can add more members anytime after creating the trip.</div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Travel style</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {["budget", "mid-range", "luxury"].map((s) => (
                    <button key={s} onClick={() => { setForm({ ...form, travel_style: s }); setEstimate(null); }}
                      className={`py-2.5 rounded-full text-sm font-semibold transition ${form.travel_style === s ? "bg-brand text-white" : "bg-white border border-black/10 text-ink-secondary"}`}
                      data-testid={`style-${s}`}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ai-border rounded-2xl bg-magic-light/40 p-4 relative overflow-hidden" data-testid="ai-budget-card">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-magic"><Sparkles className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">AI Budget Estimator</div>
                    <div className="text-xs text-ink-secondary">{days} {days === 1 ? "day" : "days"} · {peopleCount} people · {form.destinations.join(", ") || "(add destinations)"}</div>
                  </div>
                </div>

                {!estimate && !estimating && (
                  <button onClick={runEstimate} className="w-full bg-magic text-white font-semibold py-3 rounded-full active:scale-[0.98] transition" data-testid="run-estimate">
                    ✨ Estimate my budget
                  </button>
                )}
                {estimating && <AILoading label="Estimating your trip" />}
                {estimate && (
                  <div className="space-y-3" data-testid="estimate-result">
                    <div className="flex items-baseline justify-between border-b border-black/5 pb-3">
                      <div className="text-xs font-semibold uppercase tracking-widest text-ink-tertiary">Estimated total</div>
                      <div className="font-display text-3xl font-bold tabular">{fmt(estimate.total, estimate.currency)}</div>
                    </div>
                    {["stay", "food", "travel", "activities"].map((k, i) => {
                      const val = estimate[k] || 0;
                      const pct = Math.round((val / (estimate.total || 1)) * 100);
                      const colors = ["#1A3626", "#D85C40", "#4A6273", "#C29329"];
                      return (
                        <div key={k}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="capitalize font-semibold">{k}</span>
                            <span className="tabular font-semibold">{fmt(val, estimate.currency)} <span className="text-ink-tertiary text-xs font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.1 + i * 0.08, duration: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: colors[i] }} />
                          </div>
                        </div>
                      );
                    })}
                    {estimate.tips?.length > 0 && (
                      <div className="pt-2">
                        <div className="text-xs uppercase font-semibold tracking-wider text-ink-tertiary mb-1.5">AI tips</div>
                        <ul className="space-y-1 text-xs text-ink-secondary">
                          {estimate.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="text-magic">•</span>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    <button onClick={runEstimate} className="text-xs text-magic font-semibold" data-testid="re-estimate">
                      ↻ Re-run estimate
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-4 border border-black/5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink-secondary">Trip</span><span className="font-semibold">{form.name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-ink-secondary">Dates</span><span className="font-semibold">{form.start_date || "—"} → {form.end_date || "—"}</span></div>
                <div className="flex justify-between"><span className="text-ink-secondary">Destinations</span><span className="font-semibold text-right">{form.destinations.join(", ") || "—"}</span></div>
                <div className="flex justify-between"><span className="text-ink-secondary">Members</span><span className="font-semibold">{peopleCount}</span></div>
                <div className="flex justify-between"><span className="text-ink-secondary">Currency</span><span className="font-semibold tabular">{form.currency}</span></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 left-0 right-0 bg-bg-app/90 backdrop-blur px-5 py-4 border-t border-black/5">
        {step < 3 ? (
          <button disabled={!stepComplete[step]} onClick={() => setStep(step + 1)} className="w-full bg-brand disabled:opacity-50 text-white font-semibold py-3.5 rounded-full active:scale-[0.98] transition" data-testid="step-next">
            Continue →
          </button>
        ) : (
          <button disabled={saving} onClick={save} className="w-full bg-brand text-white font-semibold py-3.5 rounded-full active:scale-[0.98] transition disabled:opacity-60" data-testid="create-submit">
            {saving ? "Creating…" : "Create trip ✨"}
          </button>
        )}
      </div>
    </div>
  );
}
