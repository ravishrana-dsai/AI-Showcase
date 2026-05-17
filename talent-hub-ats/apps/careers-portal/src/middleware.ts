import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * [Company] (and similar proxies) may forward only the path *after* the mount
 * (e.g. `/` or `/jobs`) while this app is built with `basePath=/careers`.
 * Without a rewrite, those requests 404. Prefix missing basePath via rewrite.
 */
export function middleware(request: NextRequest) {
  const raw = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "";
  const base = raw.replace(/\/$/, "");
  if (!base) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === base || pathname.startsWith(`${base}/`)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? `${base}/` : `${base}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Skip all Next internals + favicon, or rewrites can break JS/RSC → blank screen
    "/((?!_next/|favicon.ico).*)",
  ],
};
