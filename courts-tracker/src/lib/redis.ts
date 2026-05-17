import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// Cache helpers
export const CACHE_KEYS = {
  dashboardStats: "dashboard:stats",
  courtList: "courts:list",
  courtStats: (courtId: string) => `court:${courtId}:stats`,
  requestsByStage: "requests:by-stage",
  slaBreaches: "sla:breaches",
} as const;

export const CACHE_TTL = {
  short: 60,      // 1 min — live ops data
  medium: 300,    // 5 min — aggregated stats
  long: 3600,     // 1 hour — reference data
} as const;

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: unknown, ttl = CACHE_TTL.medium): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch {
    // Cache failures are non-fatal
  }
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Non-fatal
  }
}
