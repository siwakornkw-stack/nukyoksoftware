import { NextRequest, NextResponse } from "next/server";

// Redirect unauthenticated page navigation to /login. This is a UX gate only:
// it checks cookie *presence* (jsonwebtoken is not edge-safe), while pages and
// route handlers verify the token signature via getSession()/verifyToken().
//
// Public paths (no auth): login, auth API, LINE webhook, cron endpoints, and
// uploaded file serving.
const PUBLIC_PREFIXES = [
  "/login",
  "/privacy", // linked from the Google OAuth consent screen
  "/api/auth",
  "/api/fuel/webhook",
  "/api/cron",
  "/manifest.webmanifest", // fetched without cookies
];

const COOKIE = "dvk_session";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const hasCookie = Boolean(req.cookies.get(COOKIE)?.value);
  if (!hasCookie) {
    // A redirect would turn an expired-session fetch into POST /login, a 404 with
    // no JSON, and every form would show only "บันทึกไม่สำเร็จ". Export links are
    // navigations and still go to the login page.
    if (pathname.startsWith("/api/") && req.headers.get("sec-fetch-mode") !== "navigate") {
      return NextResponse.json({ error: "เซสชันหมดอายุ กรุณารีเฟรชหน้าแล้วเข้าสู่ระบบใหม่" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Server layouts cannot see the URL; (app)/layout.tsx reads this to decide
  // whether an admin without two-step login may view the page.
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
