// Maintenance-mode gate (branding-approval hold). Pure logic only so it can
// be unit-tested and run in the Edge runtime — middleware.ts does the wiring.
// See specs/maintenance-mode.md for the operational runbook.

export type MaintenanceRouting =
  | { action: "none" }
  | { action: "rewrite"; destination: "/maintenance" }
  | { action: "redirect"; destination: "/" };

// Truthy spellings accepted for MAINTENANCE_MODE. Anything else — including
// unset — means the site runs normally, so a typo fails open to the real app
// rather than accidentally taking the site down.
const ENABLED_VALUES = new Set(["1", "true", "on", "yes"]);

export function isMaintenanceEnabled(raw: string | null | undefined): boolean {
  return ENABLED_VALUES.has((raw ?? "").trim().toLowerCase());
}

export function routeForMaintenance(
  pathname: string,
  enabled: boolean
): MaintenanceRouting {
  if (enabled) {
    return pathname === "/maintenance"
      ? { action: "none" }
      : { action: "rewrite", destination: "/maintenance" };
  }
  // Gate is off: don't let a bookmarked /maintenance keep showing downtime.
  return pathname === "/maintenance"
    ? { action: "redirect", destination: "/" }
    : { action: "none" };
}
