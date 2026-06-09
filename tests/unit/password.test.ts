import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  passwordIssues,
} from "@/lib/password";

describe("hashPassword / verifyPassword (scrypt)", () => {
  it("hashes are not the plain password", async () => {
    const hash = await hashPassword("hunter2-cougars");
    expect(hash).not.toContain("hunter2-cougars");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("hashes for the same password differ each call (random salt)", async () => {
    const a = await hashPassword("hunter2-cougars");
    const b = await hashPassword("hunter2-cougars");
    expect(a).not.toBe(b);
  });

  it("verifyPassword returns true on the correct password", async () => {
    const hash = await hashPassword("hunter2-cougars");
    await expect(verifyPassword("hunter2-cougars", hash)).resolves.toBe(true);
  });

  it("verifyPassword returns false on the wrong password", async () => {
    const hash = await hashPassword("hunter2-cougars");
    await expect(verifyPassword("Hunter2-Cougars", hash)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("verifyPassword returns false on a malformed hash", async () => {
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
    await expect(verifyPassword("anything", "not.a.scrypt.hash")).resolves.toBe(
      false
    );
  });
});

describe("passwordIssues", () => {
  it("rejects passwords shorter than 8", () => {
    expect(passwordIssues("short")).toContain(
      "Password must be at least 8 characters."
    );
  });

  it("rejects passwords without a letter and a number", () => {
    expect(passwordIssues("aaaaaaaa")).toContain(
      "Password must include at least one letter and one number."
    );
    expect(passwordIssues("11111111")).toContain(
      "Password must include at least one letter and one number."
    );
  });

  it("accepts an 8+ character password with a letter and number", () => {
    expect(passwordIssues("cougars12")).toEqual([]);
  });

  it("rejects passwords over 200 chars to prevent DoS via scrypt", () => {
    expect(passwordIssues("a1" + "x".repeat(201))).toContain(
      "Password must be 200 characters or fewer."
    );
  });
});
