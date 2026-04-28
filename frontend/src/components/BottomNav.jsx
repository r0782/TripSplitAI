import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, BarChart3, Plus, User } from "lucide-react";

const tabs = [
  { key: "trips", icon: Home, label: "Trips", path: "/" },
  { key: "insights", icon: BarChart3, label: "Insights", path: "/insights" },
  { key: "profile", icon: User, label: "Profile", path: "/profile" },
];

export default function BottomNav({ onCreate }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  return (
    <div className="fixed bottom-0 inset-x-0 sm:max-w-[430px] sm:left-1/2 sm:-translate-x-1/2 z-40 pointer-events-none" data-testid="bottom-nav">
      <div className="relative mx-3 mb-3 pointer-events-auto">
        <div className="backdrop-blur-xl bg-white/90 border border-black/5 rounded-full shadow-lg px-3 py-2 flex items-center justify-between">
          {tabs.slice(0, 1).map(({ key, icon: Icon, label, path }) => (
            <button
              key={key}
              onClick={() => nav(path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-full active:scale-95 transition min-w-[56px] ${pathname === path ? "text-brand" : "text-ink-tertiary"}`}
              data-testid={`nav-${key}`}
            >
              <Icon className="w-5 h-5" strokeWidth={pathname === path ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </button>
          ))}
          <button
            onClick={onCreate}
            className="relative -top-4 w-14 h-14 bg-brand rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition hover:bg-brand-hover ring-4 ring-bg-app"
            data-testid="nav-create"
            aria-label="Create"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
          {tabs.slice(1).map(({ key, icon: Icon, label, path }) => (
            <button
              key={key}
              onClick={() => nav(path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-full active:scale-95 transition min-w-[56px] ${pathname === path ? "text-brand" : "text-ink-tertiary"}`}
              data-testid={`nav-${key}`}
            >
              <Icon className="w-5 h-5" strokeWidth={pathname === path ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
