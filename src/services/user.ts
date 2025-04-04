import pool from "../config/db";

export async function getPostsByUserId(userId: number) {
  const result = await pool.query(
    `
    SELECT 
      p.id,
      p.title,
      p.slug,
      p.image_url,
      p.created_at
    FROM posts p
    WHERE p.author_id = $1
    ORDER BY p.created_at DESC
    `,
    [userId]
  );

  return result.rows.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    image_url: post.image_url,
    created_at: post.created_at,
  }));
}

export async function updateUserProfile(
  userId: number,
  name?: string,
  imageUrl?: string,
  email?: string
) {
  const result = await pool.query(
    `
    UPDATE users
    SET
     name = COALESCE($1, name),
     image_url = COALESCE($2, image_url),
     email = COALESCE($3, email)
    WHERE id = $4
    RETURNING id, name, email, image_url
    `,
    [name, imageUrl, email, userId]
  );

  return result.rows[0];
}
