import { cacheKey, getCache, invalidateCache, setCache } from "../config/cache";
import pool from "../config/db";
import { createRateLimiter } from "../config/ratelimiter";

export async function toggleFavorite(userId: number, postId: number) {
  const limiter = createRateLimiter({ limit: 10, windowSeconds: 60 });
  const { success } = await limiter(userId.toString());
  if (!success) throw new Error("Too many requests, Pls try again later");
  const check = await pool.query(
    `
    SELECT 1 FROM favorites WHERE user_id = $1 AND post_id = $2
    `,
    [userId, postId]
  );

  if (check.rows.length > 0) {
    await pool.query(
      `
      DELETE FROM favorites WHERE user_id = $1 AND post_id = $2
      `,
      [userId, postId]
    );
    await invalidateCache(cacheKey(["favorites", userId.toString()]));
    return { status: "removed" };
  } else {
    await pool.query(
      `
       INSERT INTO favorites (user_id, post_id) VALUES ($1, $2)
      `,
      [userId, postId]
    );

    await invalidateCache(cacheKey(["favorites", userId.toString()]));
    return { status: "saved" };
  }
}

export async function getfavorites(userId: number) {
  const key = cacheKey(["favorites", userId.toString()]);
  const cached = await getCache(key);
  if (cached) {
    return cached;
  }
  const result = await pool.query(
    `
    SELECT 
     p.id, p.title, p.slug, p.image_url, p.created_at,
     u.id AS author_id, u.name AS author_name
    FROM favorites f
    JOIN posts p ON f.post_id = p.id
    JOIN users u ON p.author_id = u.id
    WHERE f.user_id = $1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    return [];
  }

  const resultObj = result.rows.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    image_url: post.image_url,
    created_at: post.created_at,
    author: {
      id: post.author_id,
      name: post.author_name,
    },
  }));

  await setCache(key, resultObj, 300);

  return resultObj;
}
