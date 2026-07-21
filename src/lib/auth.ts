import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

// Unified app auth (JWT in an httpOnly cookie) shared by all three modules.
// Fail closed in production if the secret is unset; only fall back in dev so a
// misconfigured VPS cannot silently sign tokens with a publicly-known constant.
// Resolved lazily so `next build` (which runs with NODE_ENV=production but no
// runtime env) does not throw at import time.
function getSecret(): string {
  const s = process.env.JWT_ACCESS_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_ACCESS_SECRET must be set in production");
  }
  return "dev-insecure-secret-change-me";
}
const LIFETIME = process.env.JWT_ACCESS_LIFETIME || "7d";
const COOKIE = "dvk_session";

export interface Session {
  sub: string; // customer id
  username: string;
  role: string; // admin | staff
  name?: string;
  tenantId: string;
}

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export function signToken(s: Session): string {
  return jwt.sign(s, getSecret(), { expiresIn: LIFETIME } as jwt.SignOptions);
}

export function verifyToken(token: string): Session | null {
  try {
    return jwt.verify(token, getSecret()) as Session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

// Guard for server components / route handlers.
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}
