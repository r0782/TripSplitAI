import React, { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Check, AlertCircle } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, duration: 3500, kind: "info", ...toast };
    setToasts((prev) => [...prev, t]);
    if (t.duration) {
      setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), t.duration);
    }
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((p) => p.filter((x) => x.id !== id));
  }, []);

  const api = {
    show: push,
    ai: (opts) => push({ ...opts, kind: "ai", duration: opts.duration ?? 0 }),
    success: (title, description) => push({ title, description, kind: "success" }),
    error: (title, description) => push({ title, description, kind: "error" }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed inset-x-0 top-0 z-[100] max-w-md mx-auto px-4 pt-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className={`mb-2 pointer-events-auto rounded-2xl shadow-lg border border-black/5 overflow-hidden bg-white ${t.kind === "ai" ? "ai-border" : ""}`}
              data-testid={`toast-${t.kind}`}
            >
              {t.kind === "ai" && (
                <div className="h-0.5 bg-gradient-to-r from-magic via-accent to-magic" />
              )}
              <div className="p-3 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  t.kind === "ai" ? "bg-magic-light text-magic" :
                  t.kind === "success" ? "bg-green-50 text-success" :
                  t.kind === "error" ? "bg-red-50 text-error" : "bg-bg-elevated text-ink-primary"
                }`}>
                  {t.kind === "ai" ? <Sparkles className="w-5 h-5" /> :
                   t.kind === "success" ? <Check className="w-5 h-5" /> :
                   t.kind === "error" ? <AlertCircle className="w-5 h-5" /> :
                   <Sparkles className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  {t.title && <div className="font-semibold text-sm text-ink-primary">{t.title}</div>}
                  {t.description && <div className="text-sm text-ink-secondary mt-0.5">{t.description}</div>}
                  {t.actions && (
                    <div className="flex gap-2 mt-2.5">
                      {t.actions.map((a, i) => (
                        <button
                          key={i}
                          onClick={() => { a.onClick?.(); dismiss(t.id); }}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                            a.primary ? "bg-brand text-white" : "bg-bg-elevated text-ink-primary"
                          }`}
                          data-testid={`toast-action-${i}`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => dismiss(t.id)} className="text-ink-tertiary p-1" data-testid="toast-close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
