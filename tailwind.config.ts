import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1B3A6B",
          50: "#f1f5fb",
          100: "#dde7f3",
          200: "#b8cce5",
          300: "#86a8d0",
          400: "#5483b8",
          500: "#34669f",
          600: "#26517f",
          700: "#1B3A6B",
          800: "#152c52",
          900: "#101f3a",
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
        // BYU-Idaho brand palette. Primary = #006EB6. Accents used sparingly.
        // Gray is the official #949598.
        byui: {
          blue: "#006EB6",
          "blue-dark": "#214491",
          "blue-mid": "#4F9ACF",
          "blue-light": "#A0D4ED",
          gray: "#949598",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 24px rgba(27, 58, 107, 0.08)",
        lift: "0 12px 40px rgba(27, 58, 107, 0.14)",
      },
    },
  },
  plugins: [],
} satisfies Config;
