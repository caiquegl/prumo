import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionTokenEdge } from "@/lib/admin/session-edge";

function bearerOk(req: NextRequest): boolean {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const queueSecret = process.env.QUEUE_API_SECRET?.trim();
  const adminPass = process.env.ADMIN_PASSWORD?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (queueSecret && token === queueSecret) return true;
  if (adminPass && token === adminPass) return true;
  if (cronSecret && token === cronSecret) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsAuth =
    pathname.startsWith("/posts") ||
    pathname.startsWith("/api/posts");

  if (!needsAuth) return NextResponse.next();

  if (pathname.startsWith("/api/posts") && bearerOk(req)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const ok = await verifySessionTokenEdge(token);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/posts/:path*", "/api/posts/:path*"],
};
