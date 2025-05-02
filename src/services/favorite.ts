import pool from "../config/db";
import { invalidateTrendingPosts } from "./cacheService";

export async function toggleFavorite(userId: number, postId: number) {
 
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
    return { status: "removed" };
  } else {
    await pool.query(
      `
       INSERT INTO favorites (user_id, post_id) VALUES ($1, $2)
      `,
      [userId, postId]
    );

    await invalidateTrendingPosts();

    return { status: "saved" };
  }
}

export async function getfavorites(userId: number) {
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
  return result.rows.map((post) => ({
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

}
