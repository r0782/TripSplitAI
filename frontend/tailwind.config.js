/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Fraunces'", "Georgia", "serif"],
        sans: ["'Manrope'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        bg: {
          app: "#F9F8F6",
          surface: "#FFFFFF",
          elevated: "#F2F0EA",
        },
        ink: {
          primary: "#1A1A1A",
          secondary: "#737373",
          tertiary: "#A3A3A3",
        },
        brand: {
          DEFAULT: "#1A3626",
          hover: "#254D36",
        },
        accent: {
          DEFAULT: "#D85C40",
          hover: "#E56B50",
        },
        magic: {
          DEFAULT: "#C29329",
          light: "#FDF7E7",
        },
        success: "#2D6A4F",
        warn: "#E9C46A",
        error: "#E63946",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0,0,0,0.04), 0 1px 1px 0 rgba(0,0,0,0.04)",
        sheet: "0 -8px 32px rgba(0,0,0,0.1)",
        phone: "0 20px 60px -20px rgba(26, 54, 38, 0.25), 0 8px 24px rgba(0,0,0,0.06)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pop: {
          "0%": { transform: "scale(0.9)", opacity: 0 },
          "60%": { transform: "scale(1.04)", opacity: 1 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { transform: "translateY(-120%)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s linear infinite",
        pop: "pop 240ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        slideUp: "slideUp 240ms cubic-bezier(0.33, 1, 0.68, 1)",
        slideDown: "slideDown 320ms cubic-bezier(0.33, 1, 0.68, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
