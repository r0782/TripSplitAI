import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Mail, Lock, User, Loader2 } from "lucide-react";

export default function Register() {
  const nav = useNavigate();
  const { loginWithToken } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", home_country: "IN" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      loginWithToken(data.access_token, data.user);
      toast.success("Welcome to TripSplit!", `Account created — time to plan.`);
      const pending = sessionStorage.getItem("ts_pending_invite");
      if (pending) {
        sessionStorage.removeItem("ts_pending_invite");
        nav(`/join/${pending}`);
      } else {
        nav("/");
      }
    } catch (err) {
      toast.error("Signup failed", formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-10 pb-6 bg-bg-app">
      <div className="flex items-center gap-2 mb-10">
        <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-display font-bold text-xl">T</div>
        <span className="font-display font-bold text-xl">TripSplit</span>
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">Create your account</h1>
      <p className="text-ink-secondary text-sm mb-6">One account for every trip, every crew.</p>
      <form onSubmit={submit} className="space-y-3" data-testid="register-form">
        <div className="relative">
          <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name"
            className="w-full bg-white border border-black/10 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-brand" data-testid="register-name" required />
        </div>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com"
            className="w-full bg-white border border-black/10 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-brand" data-testid="register-email" required />
        </div>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (min 6)"
            className="w-full bg-white border border-black/10 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-brand" data-testid="register-password" required minLength={6} />
        </div>
        <select value={form.home_country} onChange={(e) => setForm({ ...form, home_country: e.target.value })}
          className="w-full bg-white border border-black/10 rounded-2xl px-4 py-3.5 outline-none focus:border-brand" data-testid="register-country">
          <option value="IN">🇮🇳 India (₹ INR)</option>
          <option value="US">🇺🇸 United States ($ USD)</option>
          <option value="GB">🇬🇧 United Kingdom (£ GBP)</option>
          <option value="EU">🇪🇺 Eurozone (€ EUR)</option>
          <option value="SG">🇸🇬 Singapore (S$ SGD)</option>
          <option value="AE">🇦🇪 UAE (د.إ AED)</option>
        </select>
        <button type="submit" disabled={loading} className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-3.5 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60" data-testid="register-submit">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
        </button>
      </form>
      <Link to="/login" className="text-center text-sm text-ink-secondary mt-4" data-testid="go-login">
        Already have one? <span className="text-brand font-semibold">Sign in</span>
      </Link>
    </div>
  );
}
