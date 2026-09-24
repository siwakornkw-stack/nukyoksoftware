import { describe, expect, it } from "vitest";
import { MAX_PER_ACCOUNT, MAX_PER_IP, MAX_PER_USERNAME, clientIp, createLoginLimiter } from "@/lib/rate-limit";

const MIN = 60 * 1000;

function setup() {
  let t = 1_000_000;
  const lim = createLoginLimiter(() => t);
  return { lim, advance: (ms: number) => (t += ms) };
}

describe("login limiter", () => {
  it("locks an account from one IP after 5 failures, for 15 minutes", () => {
    const { lim, advance } = setup();
    for (let i = 0; i < MAX_PER_ACCOUNT - 1; i++) lim.fail("1.1.1.1", "admin");
    expect(lim.retryAfter("1.1.1.1", "admin")).toBe(0);
    lim.fail("1.1.1.1", "admin");
    expect(lim.retryAfter("1.1.1.1", "admin")).toBe(15 * MIN);
    advance(15 * MIN);
    expect(lim.retryAfter("1.1.1.1", "admin")).toBe(0);
  });

  it("treats usernames case-insensitively", () => {
    const { lim } = setup();
    for (let i = 0; i < MAX_PER_ACCOUNT; i++) lim.fail("1.1.1.1", i % 2 ? "ADMIN" : "admin");
    expect(lim.retryAfter("1.1.1.1", "Admin")).toBeGreaterThan(0);
  });

  it("does not lock the same account for a different IP", () => {
    const { lim } = setup();
    for (let i = 0; i < MAX_PER_ACCOUNT; i++) lim.fail("1.1.1.1", "admin");
    expect(lim.retryAfter("2.2.2.2", "admin")).toBe(0);
  });

  it("forgets old failures once the window passes", () => {
    const { lim, advance } = setup();
    for (let i = 0; i < MAX_PER_ACCOUNT - 1; i++) lim.fail("1.1.1.1", "admin");
    advance(16 * MIN);
    lim.fail("1.1.1.1", "admin");
    expect(lim.retryAfter("1.1.1.1", "admin")).toBe(0);
  });

  it("clears the account count on a successful login", () => {
    const { lim } = setup();
    for (let i = 0; i < MAX_PER_ACCOUNT - 1; i++) lim.fail("1.1.1.1", "admin");
    lim.succeed("1.1.1.1", "admin");
    lim.fail("1.1.1.1", "admin");
    expect(lim.retryAfter("1.1.1.1", "admin")).toBe(0);
  });

  it("locks an IP spraying many usernames", () => {
    const { lim } = setup();
    for (let i = 0; i < MAX_PER_IP; i++) lim.fail("6.6.6.6", `user${i}`);
    expect(lim.retryAfter("6.6.6.6", "someone-new")).toBeGreaterThan(0);
    expect(lim.retryAfter("7.7.7.7", "someone-new")).toBe(0);
  });

  it("caps guesses on one username even when every attempt claims a new IP", () => {
    const { lim } = setup();
    for (let i = 0; i < MAX_PER_USERNAME; i++) lim.fail(`10.0.0.${i}`, "admin");
    expect(lim.retryAfter("10.0.0.250", "admin")).toBeGreaterThan(0);
    expect(lim.retryAfter("10.0.0.250", "staff")).toBe(0);
  });

  it("without a known IP, the per-IP rule is skipped", () => {
    const { lim } = setup();
    for (let i = 0; i < MAX_PER_IP; i++) lim.fail(null, `user${i}`);
    expect(lim.retryAfter(null, "someone-new")).toBe(0);
    for (let i = 0; i < MAX_PER_ACCOUNT; i++) lim.fail(null, "admin");
    expect(lim.retryAfter(null, "admin")).toBeGreaterThan(0);
  });
});

describe("clientIp", () => {
  const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });
  it("prefers X-Real-IP, which the client cannot set through nginx", () => {
    expect(clientIp(req({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "1.2.3.4" }))).toBe("8.8.8.8");
  });
  it("otherwise takes the last X-Forwarded-For hop, not the client-supplied first one", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" }))).toBe("9.9.9.9");
  });
  it("returns null when neither header is there", () => {
    expect(clientIp(req({}))).toBeNull();
  });
});
