import { describe, expect, it } from "vitest";
import { hashPassword, passwordVersion } from "@/lib/auth";

describe("passwordVersion", () => {
  it("is stable for one stored hash", async () => {
    const h = await hashPassword("same-password");
    expect(passwordVersion(h)).toBe(passwordVersion(h));
    expect(passwordVersion(h)).toHaveLength(16);
  });
  it("changes when the password is set again, even to the same value", async () => {
    // bcrypt salts every hash, so a reset always ends the old sessions.
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(passwordVersion(a)).not.toBe(passwordVersion(b));
  });
});
