/**
 * In-memory sliding window rate limiter.
 * Works for single-instance deployments. Does not persist across restarts.
 * For multi-instance deployments, replace with Redis-backed implementation.
 */

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

// Periodically clean up expired entries to prevent unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60_000);
}

const DEFAULT_AUTH_LIMIT: RateLimitOptions = { limit: 60, windowSeconds: 60 };
const DEFAULT_ANON_LIMIT: RateLimitOptions = { limit: 20, windowSeconds: 60 };

export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = DEFAULT_AUTH_LIMIT
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const resetAt = now + windowMs;

  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt });
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      reset: resetAt,
    };
  }

  entry.count += 1;
  const remaining = Math.max(0, options.limit - entry.count);
  const success = entry.count <= options.limit;

  return {
    success,
    limit: options.limit,
    remaining,
    reset: entry.resetAt,
  };
}

export { DEFAULT_AUTH_LIMIT, DEFAULT_ANON_LIMIT };
