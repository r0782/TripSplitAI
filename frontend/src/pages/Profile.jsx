import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import BottomNav from "../components/BottomNav";
import { LogOut, Globe, Mail, User as UserIcon, Check } from "lucide-react";

export default function Profile() {
  const nav = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const [countries, setCountries] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/countries").then((r) => setCountries(r.data)).catch(() => {});
  }, []);

  const changeCountry = async (code) => {
    setSaving(true);
    try {
      const { data } = await api.patch("/auth/me", { home_country: code });
      updateUser(data);
      const c = countries.find((x) => x.code === code);
      toast.ai({ title: "Currency auto-detected", description: `Home currency updated to ${c?.currency} ${c?.flag}`, duration: 3000 });
    } catch (err) { toast.error("Failed", formatApiError(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-[100dvh] pb-28 bg-bg-app" data-testid="profile-page">
      <div className="px-5 pt-8">
        <p className="text-xs uppercase tracking-wider font-semibold text-ink-tertiary">Profile</p>
        <h1 className="font-display text-3xl font-semibold mt-1">You</h1>
      </div>
      <div className="px-5 mt-5 space-y-4">
        <div className="bg-white rounded-2xl p-5 border border-black/5 flex items-center gap-4" data-testid="profile-card">
          <div className="w-16 h-16 rounded-full bg-brand text-white flex items-center justify-center font-semibold text-2xl overflow-hidden">
            {user?.picture ? <img src={user.picture} alt="" className="w-full h-full object-cover" /> : (user?.name?.[0] || "T").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display text-xl font-semibold truncate">{user?.name}</div>
            <div className="text-xs text-ink-secondary truncate">{user?.email}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 divide-y divide-black/5 overflow-hidden">
          <div className="px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Home country & currency</div>
            <div className="text-sm text-ink-secondary mt-0.5">AI auto-converts foreign expenses to this currency</div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {countries.map((c) => (
              <button key={c.code} disabled={saving} onClick={() => changeCountry(c.code)}
                className="w-full flex items-center gap-3 px-5 py-3 active:bg-bg-elevated transition"
                data-testid={`country-${c.code}`}>
                <span className="text-xl">{c.flag}</span>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-ink-tertiary tabular">{c.symbol} {c.currency}</div>
                </div>
                {user?.home_country === c.code && <Check className="w-4 h-4 text-brand" />}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/5 divide-y divide-black/5">
          <div className="flex items-center gap-3 px-5 py-3 text-sm">
            <Mail className="w-4 h-4 text-ink-tertiary" />
            <div className="flex-1">Email</div>
            <div className="text-ink-secondary truncate max-w-[180px]">{user?.email}</div>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 text-sm">
            <UserIcon className="w-4 h-4 text-ink-tertiary" />
            <div className="flex-1">Name</div>
            <div className="text-ink-secondary">{user?.name}</div>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 text-sm">
            <Globe className="w-4 h-4 text-ink-tertiary" />
            <div className="flex-1">Currency</div>
            <div className="text-ink-secondary tabular">{user?.home_currency}</div>
          </div>
        </div>

        <button onClick={logout} className="w-full bg-white border border-error/30 text-error font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition" data-testid="logout-btn">
          <LogOut className="w-4 h-4" />
          Log out
        </button>

        <div className="text-center text-[11px] text-ink-tertiary pt-2">TripSplit · Prototype v1.0</div>
      </div>
      <BottomNav onCreate={() => nav("/create")} />
    </div>
  );
}
