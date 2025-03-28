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

export async function getAllPosts() {
  const result = await pool.query(`
     SELECT
      p.id, p.title, p.slug, p.content, p.image_url, p.created_at,
      u.id AS author_id, u.name AS author_name
     FROM posts p
     JOIN users u
     ON p.author_id = u.id
     ORDER BY p.created_at DESC
    `);

  return result.rows.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    image_url: post.image_url,
    created_at: post.created_at,
    author: {
      id: post.author_id,
      name: post.author_name,
    },
  }));
}

export async function getPostBySlug(slug: string) {
  const result = await pool.query(
    `
     SELECT
      p.id, p.title, p.slug, p.content, p.image_url, p.created_at,
      u.id AS author_id, u.name AS author_name
     FROM posts p
     JOIN users u
     ON p.author_id = u.id
     WHERE p.slug = $1
    `,
    [slug]
  );

  if (result.rows.length === 0) {
    throw new Error("Post not found");
  }

  const post = result.rows[0];
  if (!post) {
    throw new Error("Post not found");
  }

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    image_url: post.image_url,
    created_at: post.created_at,
    author: {
      id: post.author_id,
      name: post.author_name,
    },
  };
}
