import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Mail, Lock, Phone, Loader2 } from "lucide-react";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.4 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 8 3l5.7-5.7C34.3 5.9 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 8 3l5.7-5.7C34.3 6.9 29.4 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.2C41.2 35.6 44 30.3 44 24c0-1.3-.1-2.6-.4-3.9z"/>
  </svg>
);

export default function Login() {
  const nav = useNavigate();
  const { loginWithToken } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("email"); // email | otp
  const [email, setEmail] = useState("demo@tripsplit.app");
  const [password, setPassword] = useState("Demo@123");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      loginWithToken(data.access_token, data.user);
      toast.success("Welcome back!", `Logged in as ${data.user.name}`);
      const pending = sessionStorage.getItem("ts_pending_invite");
      if (pending) {
        sessionStorage.removeItem("ts_pending_invite");
        nav(`/join/${pending}`);
      } else {
        nav("/");
      }
    } catch (err) {
      toast.error("Login failed", formatApiError(err));
    } finally { setLoading(false); }
  };

  const handleSendOtp = () => {
    if (!phone.trim()) return toast.error("Phone required");
    setOtpSent(true);
    toast.show({ title: "OTP sent", description: "Use 123456 (prototype)", kind: "success" });
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/otp", { phone, otp, home_country: "IN" });
      loginWithToken(data.access_token, data.user);
      const pending = sessionStorage.getItem("ts_pending_invite");
      if (pending) {
        sessionStorage.removeItem("ts_pending_invite");
        nav(`/join/${pending}`);
      } else {
        nav("/");
      }
    } catch (err) {
      toast.error("OTP failed", formatApiError(err));
    } finally { setLoading(false); }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogle = () => {
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-10 pb-6 bg-gradient-to-b from-[#F4F1EA] via-bg-app to-bg-app">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-14">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-display font-bold text-xl">T</div>
          <span className="font-display font-bold text-xl text-ink-primary">TripSplit</span>
        </div>
        <div className="mb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-primary leading-tight">
            Travel together.<br/>
            <span className="italic text-brand">Split smarter.</span>
          </h1>
          <p className="text-ink-secondary mt-3 text-[15px] leading-relaxed">
            Log expenses, auto-convert currencies, and let AI handle the boring math.
          </p>
        </div>
        <div className="inline-flex self-start bg-bg-elevated rounded-full p-1 text-sm font-semibold mb-5">
          <button onClick={() => setMode("email")} className={`px-4 py-2 rounded-full ${mode === "email" ? "bg-white shadow-sm text-ink-primary" : "text-ink-secondary"}`} data-testid="mode-email">Email</button>
          <button onClick={() => setMode("otp")} className={`px-4 py-2 rounded-full ${mode === "otp" ? "bg-white shadow-sm text-ink-primary" : "text-ink-secondary"}`} data-testid="mode-otp">Phone OTP</button>
        </div>
        {mode === "email" ? (
          <form onSubmit={handleEmailLogin} className="space-y-3" data-testid="login-form">
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
                className="w-full bg-white border border-black/10 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-brand transition"
                data-testid="login-email" required />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                className="w-full bg-white border border-black/10 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-brand transition"
                data-testid="login-password" required />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-3.5 rounded-full transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2" data-testid="login-submit">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
            </button>
            <Link to="/register" className="block text-center text-sm text-ink-secondary mt-2" data-testid="go-register">
              New to TripSplit? <span className="text-brand font-semibold">Create account</span>
            </Link>
          </form>
        ) : (
          <form onSubmit={otpSent ? handleOtpLogin : (e) => { e.preventDefault(); handleSendOtp(); }} className="space-y-3" data-testid="otp-form">
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxx" disabled={otpSent}
                className="w-full bg-white border border-black/10 rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-brand disabled:opacity-60"
                data-testid="otp-phone" required />
            </div>
            {otpSent && (
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP (use 123456)"
                className="w-full bg-white border border-black/10 rounded-2xl px-4 py-3.5 outline-none focus:border-brand tabular tracking-widest text-center"
                data-testid="otp-code" required />
            )}
            <button type="submit" disabled={loading} className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-3.5 rounded-full transition active:scale-[0.98] disabled:opacity-60" data-testid="otp-submit">
              {loading ? "…" : otpSent ? "Verify & Continue" : "Send OTP"}
            </button>
            {otpSent && <button type="button" onClick={() => setOtpSent(false)} className="text-xs text-ink-secondary w-full text-center">Change phone</button>}
          </form>
        )}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-black/10" />
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-tertiary">or</span>
          <div className="flex-1 h-px bg-black/10" />
        </div>
        <button onClick={handleGoogle} className="w-full bg-white border border-black/10 hover:border-black/20 text-ink-primary font-semibold py-3.5 rounded-full flex items-center justify-center gap-3 transition active:scale-[0.98]" data-testid="google-login">
          <GoogleIcon />
          Continue with Google
        </button>
        <p className="text-[11px] text-ink-tertiary text-center mt-6 leading-relaxed">
          By continuing you agree to TripSplit's Terms & Privacy.<br/>
          Prototype build — Demo login pre-filled.
        </p>
      </motion.div>
    </div>
  );
}
