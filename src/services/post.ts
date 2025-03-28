import pool from "../config/db";

export async function createPost(
  title: string,
  slug: string,
  content: string,
  image_url: string | null,
  author_id: number,
  categoryIds: number[] = []
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const postResult = await client.query(
      `
      INSERT INTO posts (title, slug, content, image_url, author_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, slug, content, image_url, author_id, created_at
      `,
      [title, slug, content, image_url, author_id]
    );

    const post = postResult.rows[0];

    for (const categoryId of categoryIds) {
      await client.query(
        `
         INSERT INTO post_categories (post_id, category_id) VALUES ($1, $2)
        `,
        [post.id, categoryId]
      );
    }

    await client.query("COMMIT");
    return post;
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error("Failed to create post");
  } finally {
    client.release();
  }
}

export async function getAllPosts(categoryId?: number) {
  let query = `
    SELECT
     p.id, p.title, p.slug, p.content, p.image_url, p.created_at,
     u.id AS author_id, u.name AS author_name
     FROM posts p
     JOIN users u
     ON p.author_id = u.id
  `;
  const params: any[] = [];

  if (categoryId) {
    query += `
     JOIN post_categories pc
     ON p.id = pc.post_id
     WHERE pc.category_id = $1
    `;
    params.push(categoryId);
  } else {
    query += `
     ORDER BY p.created_at DESC
    `;
  }

  const result = await pool.query(query, params);

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
