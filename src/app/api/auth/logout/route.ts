import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function GET() {
  await clearSessionCookie();
  // Relative Location: behind nginx req.url is http(s)://localhost:3002, so an
  // absolute URL built from it sent the browser to localhost.
  return new NextResponse(null, { status: 307, headers: { Location: "/login" } });
}
