import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

/** Pathname relative to Next basePath (leading slash). */
function pathnameWithoutBase(pathname: string): string {
  if (basePath && pathname.startsWith(basePath)) {
    const rest = pathname.slice(basePath.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return pathname;
}

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const pathname = req.nextUrl.pathname;
  const rel = pathnameWithoutBase(pathname);

  if (!token) {
    const isPublicApi =
      rel.startsWith("/api/auth") ||
      rel.startsWith("/api/public") ||
      rel.startsWith("/api/v1");
    if (rel.startsWith("/api/") && !isPublicApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginPath = `${basePath}/login`.replace(/\/{2,}/g, "/") || "/login";
    const loginUrl = new URL(loginPath, req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // All dashboard pages
    "/dashboard/:path*",
    // All API routes except public ones (no auth required) and NextAuth internal routes
    "/api/((?!auth|public|v1).*)",
  ],
};
