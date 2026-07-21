import { NextRequest, NextResponse } from "next/server";

// Redirect unauthenticated page navigation to /login. This is a UX gate only:
// it checks cookie *presence* (jsonwebtoken is not edge-safe), while pages and
// route handlers verify the token signature via getSession()/verifyToken().
//
// Public paths (no auth): login, auth API, LINE webhook, cron endpoints, and
// uploaded file serving.
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/fuel/webhook",
  "/api/cron",
];

const COOKIE = "dvk_session";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const hasCookie = Boolean(req.cookies.get(COOKIE)?.value);
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
