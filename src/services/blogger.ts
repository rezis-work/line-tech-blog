import pool from "../config/db";

export async function getBloggerProfileById(bloggerId: number) {
  const userResult = await pool.query(
    `
    SELECT id, name, cover_image_url, image_url, bio, facebook_url, twitter_url, instagram_url, linkedin_url
    FROM users
    WHERE id = $1 AND role = 'admin'
    `,
    [bloggerId]
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  const postsResult = await pool.query(
    `
    SELECT id, title, slug, image_url, created_at
    FROM posts
    WHERE author_id = $1
    ORDER BY created_at DESC
  `,
    [bloggerId]
  );

  return {
    blogger: userResult.rows[0],
    posts: postsResult.rows,
  };
}
