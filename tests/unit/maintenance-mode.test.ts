import { describe, it, expect } from "vitest";
import {
  isMaintenanceEnabled,
  routeForMaintenance,
} from "@/lib/maintenance";

describe("isMaintenanceEnabled", () => {
  it.each(["true", "TRUE", " True ", "1", "on", "yes"])(
    "treats %j as enabled",
    (raw) => {
      expect(isMaintenanceEnabled(raw)).toBe(true);
    }
  );

  it.each(["false", "0", "off", "no", "", "  ", "maybe"])(
    "treats %j as disabled",
    (raw) => {
      expect(isMaintenanceEnabled(raw)).toBe(false);
    }
  );

  it("treats undefined/null (unset env var) as disabled", () => {
    expect(isMaintenanceEnabled(undefined)).toBe(false);
    expect(isMaintenanceEnabled(null)).toBe(false);
  });
});

describe("routeForMaintenance", () => {
  describe("when maintenance is ON", () => {
    it("rewrites the landing page to /maintenance", () => {
      expect(routeForMaintenance("/", true)).toEqual({
        action: "rewrite",
        destination: "/maintenance",
      });
    });

    it("rewrites deep pages (login, dashboard, admin)", () => {
      for (const path of ["/login", "/dashboard", "/admin/matches"]) {
        expect(routeForMaintenance(path, true)).toEqual({
          action: "rewrite",
          destination: "/maintenance",
        });
      }
    });

    it("serves /maintenance itself without a rewrite loop", () => {
      expect(routeForMaintenance("/maintenance", true)).toEqual({
        action: "none",
      });
    });
  });

  describe("when maintenance is OFF", () => {
    it("leaves normal pages alone", () => {
      expect(routeForMaintenance("/", false)).toEqual({ action: "none" });
      expect(routeForMaintenance("/login", false)).toEqual({ action: "none" });
    });

    it("redirects a stale /maintenance visit back to the landing page", () => {
      expect(routeForMaintenance("/maintenance", false)).toEqual({
        action: "redirect",
        destination: "/",
      });
    });
  });
});
