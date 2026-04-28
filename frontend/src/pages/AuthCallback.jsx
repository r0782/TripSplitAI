import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const nav = useNavigate();
  const { loginWithToken } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    (async () => {
      const hash = window.location.hash || "";
      const match = hash.match(/session_id=([^&]+)/);
      if (!match) { nav("/login"); return; }
      const session_id = match[1];
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        loginWithToken(data.access_token, data.user);
        // Clean URL
        window.history.replaceState({}, "", "/");
        const pending = sessionStorage.getItem("ts_pending_invite");
        if (pending) {
          sessionStorage.removeItem("ts_pending_invite");
          nav(`/join/${pending}`);
        } else {
          nav("/");
        }
      } catch (err) {
        console.error(formatApiError(err));
        nav("/login");
      }
    })();
  }, [nav, loginWithToken]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-bg-app text-ink-secondary gap-3" data-testid="auth-callback">
      <Loader2 className="w-6 h-6 animate-spin text-brand" />
      <div className="text-sm">Completing Google sign-in…</div>
    </div>
  );
}
