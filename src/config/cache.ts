import redis from "./redis";

export async function setCache(key: string, value: any, ttl = 3600) {
  if (!redis) {
    throw new Error("Redis is not connected");
  }
  await redis.set(key, JSON.stringify(value), "EX", ttl);
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) {
    throw new Error("Redis is not connected");
  }
  const data = await redis.get(key);
  if (data) {
    return JSON.parse(data);
  }
  return null;
}
