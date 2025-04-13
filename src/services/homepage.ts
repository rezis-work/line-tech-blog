import pool from "../config/db";
import { getCache, setCache } from "../config/cache";

export async function getTopPostsByCategory(limitPerCategory = 3) {
  const cacheKey = `top_posts_by_category:${limitPerCategory}`;
  const cached = await getCache<any[]>(cacheKey);
  if (cached) {
    return cached;
  }
  try {
    const categoriesResult = await pool.query(`
      SELECT id, name FROM categories ORDER BY name ASC
      `);

    const categories = categoriesResult.rows;

    const results: Record<string, any>[] = [];

    for (const category of categories) {
      const postsResult = await pool.query(
        `
        SELECT
         p.id, p.title, p.slug, p.image_url, p.created_at,
         u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
        FROM posts p
        JOIN post_categories pc ON pc.post_id = p.id
        JOIN users u ON p.author_id = u.id
        WHERE pc.category_id = $1
        ORDER BY p.created_at DESC
        LIMIT $2
        `,
        [category.id, limitPerCategory]
      );

      results.push({
        category: {
          id: category.id,
          name: category.name,
        },
        posts: postsResult.rows,
      });
    }
    await setCache(cacheKey, results, 3600);
    return results;
  } catch (err) {
    console.error("Error fetching top posts by category", err);
    throw new Error("Failed to fetch top posts by category");
  }
}

export async function getTrendingPosts(limit = 10) {
  const cacheKey = `trending_posts:${limit}`;
  const cached = await getCache<any[]>(cacheKey);
  if (cached) {
    return cached;
  }
  try {
    const result = await pool.query(
      `
      SELECT
       p.id, p.title, p.slug, p.image_url, p.created_at,
       u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url,
       COUNT(f.post_id) AS total_favorites
      FROM posts p
      LEFT JOIN favorites f ON f.post_id = p.id AND p.created_at >= NOW() - INTERVAL '7 days'
      JOIN users u ON p.author_id = u.id
      GROUP BY p.id, u.id
      ORDER BY COUNT(f.post_id) DESC, p.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    const trendingPosts = result.rows.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      imageUrl: post.image_url,
      createdAt: post.created_at,
      author: {
        id: post.author_id,
        name: post.author_name,
        imageUrl: post.author_image_url,
      },
      favorite_count: post.total_favorites,
    }));

    await setCache(cacheKey, trendingPosts, 3600);

    return trendingPosts;
  } catch (err) {
    console.error("Error fetching trending posts", err);
    throw new Error("Failed to fetch trending posts");
  }
}
