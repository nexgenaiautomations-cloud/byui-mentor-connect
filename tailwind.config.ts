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
