import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ICAN purple ink — headings, sidebar, primary buttons.
        plum: {
          DEFAULT: "#4A2585",
          50: "#f7f3fd",
          100: "#ede4fb",
          200: "#d9c8f5",
          300: "#bb9eec",
          400: "#9a71df",
          500: "#7c4dcc",
          600: "#6234ad",
          700: "#4A2585",
          800: "#391b68",
          900: "#26124a",
        },
        gold: {
          DEFAULT: "#C9A227",
          50: "#fdf8e7",
          100: "#faecbb",
          200: "#f4d97b",
          300: "#eec546",
          400: "#dbb030",
          500: "#C9A227",
          600: "#a0801b",
          700: "#735c14",
          800: "#4d3e0e",
          900: "#332907",
        },
        // ICAN brand palette. Primary = #6D28D9 (7:1 on white). The hero
        // gradient runs brand-ink -> brand -> brand-magenta.
        brand: {
          DEFAULT: "#6D28D9",
          dark: "#4C1D95",
          mid: "#8B5CF6",
          light: "#C4B5FD",
          ink: "#2E1065",
          magenta: "#A21CAF",
          gray: "#949598",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 24px rgba(74, 37, 133, 0.08)",
        lift: "0 12px 40px rgba(74, 37, 133, 0.14)",
      },
    },
  },
  plugins: [],
} satisfies Config;
