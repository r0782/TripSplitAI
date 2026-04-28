import React from "react";

/** Mobile phone frame that centers content on larger screens */
export default function MobileFrame({ children }) {
  return (
    <div className="min-h-[100dvh] w-full flex items-stretch sm:items-center justify-center bg-[#EEEAE0] sm:py-6">
      <div
        className="relative w-full sm:max-w-[430px] bg-bg-app min-h-[100dvh] sm:min-h-[calc(100dvh-3rem)] sm:rounded-[2.25rem] sm:shadow-phone overflow-hidden"
        data-testid="mobile-frame"
      >
        {children}
      </div>
    </div>
  );
}
