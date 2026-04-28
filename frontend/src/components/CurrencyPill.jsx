import React from "react";

export default function CurrencyPill({ amount, currency, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 bg-bg-elevated text-ink-secondary text-[11px] font-semibold rounded-full tabular ${className}`}>
      ≈ {amount} <span className="ml-0.5 opacity-70">{currency}</span>
    </span>
  );
}
