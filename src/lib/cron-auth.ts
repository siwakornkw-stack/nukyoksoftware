import { createHash, timingSafeEqual } from "crypto";

// "Authorization: Bearer <secret>" check for routes called from outside the web
// process (cron worker, backup script, Express sync). Constant time: both sides
// are hashed to equal length first, so neither the content nor the length of the
// secret leaks through response timing. An unset secret never matches.
export function bearerOk(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}
