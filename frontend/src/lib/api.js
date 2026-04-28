import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ts_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register" && !window.location.hash.includes("session_id")) {
        localStorage.removeItem("ts_token");
        localStorage.removeItem("ts_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (d?.msg) return d.msg;
  return String(d);
}

export const CURRENCY_SYMBOLS = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥", AUD: "A$",
  CAD: "C$", AED: "د.إ", SGD: "S$", THB: "฿", IDR: "Rp", MYR: "RM", CHF: "CHF",
};

export const fmt = (amount, currency = "INR") => {
  const sym = CURRENCY_SYMBOLS[currency] || currency + " ";
  const n = Number(amount || 0);
  const fixed = Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(2).replace(/\.00$/, "");
  return `${sym}${fixed}`;
};

export const TRIP_COVERS = {
  goa: "https://images.unsplash.com/photo-1685271555713-f9bf8d6c3721?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  manali: "https://images.pexels.com/photos/28680808/pexels-photo-28680808.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  bali: "https://images.unsplash.com/photo-1709140624408-0a63fb49a0d1?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  tokyo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
};

export const COVER_OPTIONS = [
  { key: "goa", label: "Beach / Tropical", url: TRIP_COVERS.goa },
  { key: "manali", label: "Mountains", url: TRIP_COVERS.manali },
  { key: "bali", label: "Island", url: TRIP_COVERS.bali },
  { key: "paris", label: "City — Europe", url: TRIP_COVERS.paris },
  { key: "tokyo", label: "City — Asia", url: TRIP_COVERS.tokyo },
  { key: "dubai", label: "Desert / Luxury", url: TRIP_COVERS.dubai },
];

export const PALETTE = ["#1A3626", "#D85C40", "#C29329", "#4A6273", "#89A78B", "#E3B992", "#B87A71", "#3B4C30"];

export const CATEGORIES = [
  { id: "Food", emoji: "🍽", color: "#D85C40" },
  { id: "Stay", emoji: "🏨", color: "#1A3626" },
  { id: "Travel", emoji: "🚕", color: "#4A6273" },
  { id: "Activities", emoji: "🎟", color: "#C29329" },
  { id: "Shopping", emoji: "🛍", color: "#B87A71" },
  { id: "Other", emoji: "📝", color: "#737373" },
];
