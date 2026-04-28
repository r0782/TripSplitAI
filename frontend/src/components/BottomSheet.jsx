import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function BottomSheet({ open, onClose, title, children, height = "auto", testId = "bottom-sheet" }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
            data-testid={`${testId}-backdrop`}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-0 inset-x-0 sm:max-w-[430px] sm:left-1/2 sm:-translate-x-1/2 bg-white rounded-t-3xl shadow-sheet z-50 max-h-[90dvh] flex flex-col"
            style={{ height: height === "full" ? "90dvh" : undefined }}
            data-testid={testId}
          >
            <div className="flex-shrink-0 pt-3 pb-2">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 pb-3">
                <h2 className="font-display text-xl font-semibold text-ink-primary">{title}</h2>
                <button onClick={onClose} className="w-9 h-9 rounded-full bg-bg-elevated flex items-center justify-center" data-testid={`${testId}-close`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
