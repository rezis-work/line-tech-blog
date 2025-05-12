import { redis } from "./redis";

export async function setCache<T>(key: string, value: T, ttlSeconds = 3600) {
  await redis.set(key, value, { ex: ttlSeconds });
}

export async function getCache<T>(key: string): Promise<T | null> {
  return await redis.get<T>(key);
}

export async function invalidateCache(key: string) {
  await redis.del(key);
}

export function chacheKey(parts: string[]) {
  return parts.join(":").toLowerCase();
}
