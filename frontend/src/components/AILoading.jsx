import React from "react";
import { Sparkles } from "lucide-react";

export default function AILoading({ label = "AI is thinking" }) {
  return (
    <div className="rounded-2xl p-4 bg-magic-light/70 border border-magic/20 flex items-center gap-3 relative overflow-hidden" data-testid="ai-loading">
      <div className="shimmer absolute inset-0" />
      <div className="relative w-9 h-9 rounded-xl bg-white flex items-center justify-center text-magic">
        <Sparkles className="w-5 h-5 animate-pulse" />
      </div>
      <div className="relative">
        <div className="font-semibold text-sm text-ink-primary">{label}</div>
        <div className="text-xs text-ink-secondary">Crunching travel data with Gemini…</div>
      </div>
    </div>
  );
}
