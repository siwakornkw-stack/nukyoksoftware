import { describe, expect, it } from "vitest";
import { bearerOk } from "@/lib/cron-auth";

const req = (auth?: string) => new Request("http://x/api/cron/test", { headers: auth ? { authorization: auth } : {} });

describe("bearerOk", () => {
  it("accepts only the exact bearer secret", () => {
    expect(bearerOk(req("Bearer s3cret"), "s3cret")).toBe(true);
    expect(bearerOk(req("Bearer s3cre"), "s3cret")).toBe(false);
    expect(bearerOk(req("s3cret"), "s3cret")).toBe(false);
    expect(bearerOk(req(), "s3cret")).toBe(false);
  });
  it("never matches when the secret is unset", () => {
    expect(bearerOk(req("Bearer "), "")).toBe(false);
    expect(bearerOk(req("Bearer undefined"), undefined)).toBe(false);
  });
});
