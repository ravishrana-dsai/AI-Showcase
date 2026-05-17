/**
 * Higher-order function to apply rate limiting to Next.js API route handlers.
 * Usage:
 *   export const GET = withRateLimit(async (req) => { ... });
 *   export const POST = withRateLimit(async (req) => { ... }, { limit: 10, windowSeconds: 60 });
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { checkRateLimit, DEFAULT_AUTH_LIMIT, DEFAULT_ANON_LIMIT } from "@/lib/rate-limit";
import type { RateLimitOptions } from "@/lib/rate-limit";

type RouteHandler = (req: NextRequest, context?: unknown) => Promise<NextResponse | Response>;

export function withRateLimit(
  handler: RouteHandler,
  options?: Partial<RateLimitOptions>
): RouteHandler {
  return async (req: NextRequest, context?: unknown) => {
    // Determine identifier: authenticated user ID or IP address
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const identifier = token?.sub ? `user:${token.sub}` : `ip:${ip}`;
    const defaults = token?.sub ? DEFAULT_AUTH_LIMIT : DEFAULT_ANON_LIMIT;
    const limitOptions: RateLimitOptions = {
      limit: options?.limit ?? defaults.limit,
      windowSeconds: options?.windowSeconds ?? defaults.windowSeconds,
    };

    const result = await checkRateLimit(identifier, limitOptions);

    if (!result.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": "0",
            "Retry-After": String(result.reset - Math.floor(Date.now() / 1000)),
          },
        }
      );
    }

    const response = await handler(req, context);

    // Attach rate limit headers to successful responses
    if (response instanceof NextResponse) {
      response.headers.set("X-RateLimit-Limit", String(result.limit));
      response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    }

    return response;
  };
}
