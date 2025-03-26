import pool from "../config/db";

export async function createPost(
  title: string,
  slug: string,
  content: string,
  image_url: string | null,
  author_id: number
) {
  try {
    const result = await pool.query(
      `
      INSERT INTO posts (title, slug, content, image_url, author_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, slug, content, image_url, author_id, created_at
      `,
      [title, slug, content, image_url, author_id]
    );

    return result.rows[0];
  } catch (err) {
    throw new Error("Failed to create post");
  }
}
