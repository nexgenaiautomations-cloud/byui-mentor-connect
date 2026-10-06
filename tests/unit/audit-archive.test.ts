import { describe, it, expect } from "vitest";
import {
  ARCHIVE_COLUMNS,
  normalizeUserAgent,
  toArchiveRow,
  toCsv,
} from "@/lib/audit-archive";
import type { AuditEvent } from "@/db/schema";

// A representative row as it comes out of Postgres.
function sampleEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    createdAt: new Date("2025-01-15T18:30:00.000Z"),
    actorUserId: "usr_actor_abc",
    targetUserId: "usr_target_xyz",
    eventType: "ADMIN_PROMOTED_USER",
    severity: "info",
    ipHash: "a".repeat(64),
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    metadataJson: JSON.stringify({ byEmail: true, reason: "promotion" }),
    ...overrides,
  } as AuditEvent;
}

describe("normalizeUserAgent", () => {
  it("reduces a full UA string to browser and OS family only", () => {
    expect(
      normalizeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      )
    ).toBe("Chrome on Windows");
  });

  it("identifies Edge before Chrome, since Edge's UA contains both", () => {
    expect(
      normalizeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
      )
    ).toBe("Edge on Windows");
  });

  it("identifies Chrome before Safari, since Chrome's UA contains both", () => {
    expect(normalizeUserAgent("... Chrome/131.0.0.0 Safari/537.36")).toBe(
      "Chrome on unknown"
    );
  });

  it("recognises Safari on iOS", () => {
    expect(
      normalizeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
      )
    ).toBe("Safari on iOS");
  });

  it("recognises Firefox on Linux", () => {
    expect(
      normalizeUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0")
    ).toBe("Firefox on Linux");
  });

  it("retains no version numbers at all", () => {
    const out = normalizeUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15"
    );
    expect(out).toBe("Safari on macOS");
    expect(out).not.toMatch(/\d/);
  });

  it("collapses an unrecognised UA rather than passing it through", () => {
    expect(normalizeUserAgent("SomeCustomScraper/9.9 (+http://example.com/bot)")).toBe(
      "other on unknown"
    );
  });

  it("passes null through", () => {
    expect(normalizeUserAgent(null)).toBeNull();
  });
});

describe("toArchiveRow", () => {
  it("emits exactly the declared archive columns", () => {
    const row = toArchiveRow(sampleEvent());
    expect(Object.keys(row)).toEqual([...ARCHIVE_COLUMNS]);
  });

  it("carries the opaque user IDs through unchanged", () => {
    const row = toArchiveRow(sampleEvent());
    expect(row.actor_user_id).toBe("usr_actor_abc");
    expect(row.target_user_id).toBe("usr_target_xyz");
  });

  it("carries the hashed IP, never anything resembling an address", () => {
    const row = toArchiveRow(sampleEvent());
    expect(row.ip_hash).toBe("a".repeat(64));
    expect(row.ip_hash).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it("writes the normalized user agent, not the raw string", () => {
    const row = toArchiveRow(sampleEvent());
    expect(row.user_agent).toBe("Chrome on Windows");
    expect(row.user_agent).not.toContain("AppleWebKit");
  });

  it("formats the timestamp as ISO 8601 UTC", () => {
    const row = toArchiveRow(sampleEvent());
    expect(row.created_at).toBe("2025-01-15T18:30:00.000Z");
  });

  it("renders null columns as empty strings", () => {
    const row = toArchiveRow(
      sampleEvent({ actorUserId: null, ipHash: null, userAgent: null, metadataJson: null })
    );
    expect(row.actor_user_id).toBe("");
    expect(row.ip_hash).toBe("");
    expect(row.user_agent).toBe("");
    expect(row.metadata_json).toBe("");
  });

  // The de-identification guarantee: the export shape has no slot for a name
  // or an email, so no join can smuggle one in without failing this test.
  it("has no column that could hold a name or an email address", () => {
    const row = toArchiveRow(sampleEvent());
    for (const key of Object.keys(row)) {
      expect(key).not.toMatch(/name|email|phone/i);
    }
  });

  it("does not leak an email even if one reaches metadata", () => {
    const row = toArchiveRow(
      sampleEvent({ metadataJson: JSON.stringify({ note: "student@byui.edu" }) })
    );
    expect(row.metadata_json).not.toContain("@byui.edu");
    expect(row.metadata_json).toContain("[redacted-email]");
  });
});

describe("toCsv", () => {
  it("starts with the declared header row", () => {
    const csv = toCsv([sampleEvent()]);
    expect(csv.split("\n")[0]).toBe(ARCHIVE_COLUMNS.join(","));
  });

  it("writes one line per event", () => {
    const csv = toCsv([sampleEvent(), sampleEvent({ id: "other-id" })]);
    expect(csv.trim().split("\n")).toHaveLength(3); // header + 2
  });

  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = toCsv([
      sampleEvent({ metadataJson: JSON.stringify({ a: 1, b: "x,y" }) }),
    ]);
    expect(csv).toContain('"{""a"":1,""b"":""x,y""}"');
  });

  it("produces a header-only file for an empty set", () => {
    expect(toCsv([]).trim()).toBe(ARCHIVE_COLUMNS.join(","));
  });
});
