import redis from "../config/redis";

export async function invalidateTrendingPosts(limit = 10) {
  try {
    const key = `trending_posts:${limit}`;
    await redis.del(key);
    console.log(`Trending posts cache invalidated for limit ${limit}`);
  } catch (error) {
    console.error("Error invalidating trending posts cache", error);
  }
}

export async function invalidateBestByCategory(category: string) {
  try {
    const key = `best_by_category:${category}`;
    await redis.del(key);
    console.log(`Best by category cache invalidated for category ${category}`);
  } catch (error) {
    console.error("Error invalidating best by category cache", error);
  }
}
