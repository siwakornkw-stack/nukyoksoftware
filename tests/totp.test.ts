import { describe, expect, it } from "vitest";
import { newTotpSecret, totpAt, verifyTotp } from "@/lib/totp";

// RFC 6238 appendix B test key "12345678901234567890" in base32.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP", () => {
  it("matches the RFC 6238 SHA1 test vectors (last 6 digits)", () => {
    expect(totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpAt(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpAt(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("accepts the current code and one step of drift, rejects others", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30000);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step), "u1", now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), "u2", now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 3), "u3", now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "12345", "u4", now)).toBe(false);
  });

  it("refuses to replay a code that was already used", () => {
    const now = 1_700_000_100_000;
    const code = totpAt(RFC_SECRET, Math.floor(now / 30000));
    expect(verifyTotp(RFC_SECRET, code, "replay", now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, "replay", now)).toBe(false);
  });

  it("makes 32-character base32 secrets", () => {
    expect(newTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });
});
