import { createHmac, randomBytes } from "crypto";

// TOTP (RFC 6238, the Google Authenticator kind): HMAC-SHA1, 6 digits, 30 s.
const STEP = 30;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(s: string): Buffer {
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error("bad base32");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const off = h[h.length - 1] & 0x0f;
  const n = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

// A code used once cannot be replayed within its window (single web process).
const usedSteps = new Map<string, number>();

// Accepts the current step and one either side (phone clock drift).
export function verifyTotp(secret: string, code: string, userKey: string, now = Date.now()): boolean {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(now / 1000 / STEP);
  for (const s of [step - 1, step, step + 1]) {
    if (totpAt(secret, s) === c) {
      if ((usedSteps.get(userKey) ?? -1) >= s) return false;
      usedSteps.set(userKey, s);
      return true;
    }
  }
  return false;
}

export function otpauthUri(secret: string, account: string): string {
  const issuer = "dhevakij";
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=${STEP}`;
}
