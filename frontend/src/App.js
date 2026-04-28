import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import MobileFrame from "./components/MobileFrame";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";
import CreateTrip from "./pages/CreateTrip";
import TripDetail from "./pages/TripDetail";
import Insights from "./pages/Insights";
import Profile from "./pages/Profile";
import JoinTrip from "./pages/JoinTrip";

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center text-ink-tertiary">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  // Google OAuth callback detection (URL hash) — process BEFORE other routes
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/join/:token" element={<JoinTrip />} />
      <Route path="/" element={<Guard><Home /></Guard>} />
      <Route path="/create" element={<Guard><CreateTrip /></Guard>} />
      <Route path="/trip/:tripId" element={<Guard><TripDetail /></Guard>} />
      <Route path="/insights" element={<Guard><Insights /></Guard>} />
      <Route path="/profile" element={<Guard><Profile /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MobileFrame>
          <AppRouter />
        </MobileFrame>
      </ToastProvider>
    </AuthProvider>
  );
}
