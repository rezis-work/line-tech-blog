import pool from "../config/db";
import { getCache, setCache } from "../config/cache";
import {
  invalidateTrendingPosts,
} from "./cacheService";
export async function getTopPostsByCategory(limitPerCategory = 3) {
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
          p.id, p.title, p.slug, p.image_url, p.content, p.created_at,
          u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url,
          COALESCE((
            SELECT COUNT(*) FROM comments WHERE post_id = p.id
          ), 0) AS comment_count,
          COALESCE((
            SELECT COUNT(*) FROM favorites WHERE post_id = p.id
          ), 0) AS favorite_count
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
        posts: postsResult.rows.map((post) => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          imageUrl: post.image_url,
          excerpt: post.content.substring(0, 100) + "...",
          createdAt: post.created_at,
          author: {
            id: post.author_id,
            name: post.author_name,
            imageUrl: post.author_image_url,
          },
          commentCount: post.comment_count,
          favoriteCount: post.favorite_count,
        })),
      });
    }

    return results;
  } catch (err) {
    console.error("Error fetching top posts by category", err);
    throw new Error("Failed to fetch top posts by category");
  }
}

export async function getTrendingPosts(limit = 10) {
  
  try {
    const result = await pool.query(
      `
      SELECT
        p.id, p.title, p.slug, p.image_url, p.created_at,
        u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url,
        (
          SELECT COUNT(*) FROM favorites f
          WHERE f.post_id = p.id AND f.created_at >= NOW() - INTERVAL '7 days'
        ) AS favorite_count,
        (
          SELECT COUNT(*) FROM comments c
          WHERE c.post_id = p.id AND c.created_at >= NOW() - INTERVAL '7 days'
        ) AS comment_count
       FROM posts p
       JOIN users u ON p.author_id = u.id
       ORDER BY comment_count DESC, p.created_at DESC
       LIMIT $1
      `,
      [limit]
    );

    const postIds = result.rows.map((post) => post.id);

    let categoriesByPostId: Record<string, string[]> = {};
    if (postIds.length > 0) {
      const placeholders = postIds.map((_, index) => `$${index + 1}`).join(",");
      const catResult = await pool.query(
        `
         SELECT pc.post_id, c.name
         FROM post_categories pc
         JOIN categories c ON pc.category_id = c.id
         WHERE pc.post_id IN (${placeholders})
        `,
        postIds
      );

      for (const row of catResult.rows) {
        if (!categoriesByPostId[row.post_id]) {
          categoriesByPostId[row.post_id] = [];
        }
        categoriesByPostId[row.post_id].push(row.name);
      }
    }

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
      favoriteCount: post.favorite_count,
      commentCount: post.comment_count,
      categories: categoriesByPostId[post.id] || [],
    }));

  
  
    return trendingPosts;
  } catch (err) {
    console.error("Error fetching trending posts", err);
    throw new Error("Failed to fetch trending posts");
  }
}
