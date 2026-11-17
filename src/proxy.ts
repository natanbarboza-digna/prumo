// Optimistic check (plan 014): without the session cookie, send the visitor to
// the login page. It does not query the database; the real check is
// requireSession() in every Server Action and the session guard in the layout.
// (Next 16 renamed Middleware to Proxy.)

import { type NextRequest, NextResponse } from "next/server";

import { LOGIN_PATH } from "@/modules/auth/redirect";

// Same name as SESSION_COOKIE in src/modules/auth/session.ts, which imports
// next/headers and so cannot be imported here.
const SESSION_COOKIE = "prumo_session";

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL(LOGIN_PATH, request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login page itself, Next's own files and the icon.
  matcher: ["/((?!login|_next/static|_next/image|icon.svg).*)"],
};
