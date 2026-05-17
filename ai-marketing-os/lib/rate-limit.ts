/** In-memory sliding window rate limiter. Safe for single-process (dev + single-instance prod). */

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

export interface RateLimitResult {
  success: boolean
  remaining: number
  retryAfterMs: number
}

/**
 * Check whether a key is within its rate limit.
 * @param key      Unique string per client+action (e.g. "ip:POST:/api/agents")
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  if (bucket.count >= limit) {
    return { success: false, remaining: 0, retryAfterMs: bucket.resetAt - now }
  }

  store.set(key, { count: bucket.count + 1, resetAt: bucket.resetAt })
  return { success: true, remaining: limit - bucket.count - 1, retryAfterMs: 0 }
}

/** Extract a best-effort IP string from a Next.js Request. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
