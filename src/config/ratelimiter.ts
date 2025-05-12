import { redis } from "./redis";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export function createRateLimiter({
  limit,
  windowSeconds,
}: {
  limit: number;
  windowSeconds: number;
}) {
  return async (identifier: string): Promise<RateLimitResult> => {
    const key = `ratelimit:${identifier}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);

    return {
      success: current <= limit,
      remaining: Math.max(limit - current, 0),
      reset: Date.now() + ttl * 1000,
    };
  };
}
