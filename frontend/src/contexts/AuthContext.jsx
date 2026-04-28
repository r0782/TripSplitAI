import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("ts_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      localStorage.setItem("ts_user", JSON.stringify(data));
      return data;
    } catch {
      localStorage.removeItem("ts_token");
      localStorage.removeItem("ts_user");
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip auth check during Google OAuth callback
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    const cached = localStorage.getItem("ts_user");
    if (cached) setUser(JSON.parse(cached));
    refresh();
  }, [refresh]);

  const loginWithToken = (token, userObj) => {
    localStorage.setItem("ts_token", token);
    localStorage.setItem("ts_user", JSON.stringify(userObj));
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem("ts_token");
    localStorage.removeItem("ts_user");
    setUser(null);
    window.location.href = "/login";
  };

  const updateUser = (patch) => {
    const next = { ...user, ...patch };
    setUser(next);
    localStorage.setItem("ts_user", JSON.stringify(next));
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, logout, refresh, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
