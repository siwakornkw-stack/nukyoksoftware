import { describe, expect, it } from "vitest";
import { bahtText } from "@/lib/baht-text";

describe("bahtText", () => {
  it("writes baht amounts the Thai way", () => {
    expect(bahtText(0)).toBe("ศูนย์บาทถ้วน");
    expect(bahtText(1)).toBe("หนึ่งบาทถ้วน");
    expect(bahtText(11)).toBe("สิบเอ็ดบาทถ้วน");
    expect(bahtText(21)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(bahtText(101)).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
    expect(bahtText(1250.5)).toBe("หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์");
    expect(bahtText(1_000_000)).toBe("หนึ่งล้านบาทถ้วน");
    expect(bahtText(11_000_001)).toBe("สิบเอ็ดล้านหนึ่งบาทถ้วน");
    expect(bahtText(0.25)).toBe("ยี่สิบห้าสตางค์");
  });
});
