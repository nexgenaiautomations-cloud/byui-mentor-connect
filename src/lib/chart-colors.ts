// Chart palette, in a plain module so Server Components get real values.
// (Importing a constant from a "use client" file into a Server Component
// yields a client-reference stub, not the object — colors became undefined.)
// Brand purple first, then colors chosen for meaning: green = good,
// amber = attention, rose = risk.
export const CHART_COLORS = {
  plum: "#6D28D9",
  violet: "#A78BFA",
  ink: "#3B0764",
  emerald: "#059669",
  amber: "#D97706",
  rose: "#E11D48",
  sky: "#0284C7",
  slate: "#94A3B8",
  gold: "#B8860B",
} as const;
