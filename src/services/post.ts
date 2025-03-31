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

export async function getAllPosts(categoryId?: number, page = 1, limit = 5) {
  const offset = (page - 1) * limit;
  let baseQuery = `
   SELECT
    p.id, p.title, p.slug, p.content, p.image_url, p.created_at,
    u.id AS author_id, u.name AS author_name
   FROM posts p
   JOIN users u
   ON
    p.author_id = u.id
  `;

  let countQuery = `
   SELECT COUNT(*) FROM posts
  `;

  const params: (string | number)[] = [];
  let whereClause: string = "";

  if (categoryId) {
    whereClause = `
     JOIN post_categories pc ON pc.post_id = p.id
     WHERE pc.category_id = $1
    `;
    baseQuery += whereClause;
    countQuery += ` JOIN post_categories pc ON pc.post_id = p.id WHERE pc.category_id = $1`;
    params.push(categoryId);
  } else {
    baseQuery += ` ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`;
    params.push(limit, offset);
  }

  if (categoryId) {
    baseQuery += ` ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`;
    params.push(limit, offset);
  }

  const [postResult, countResult] = await Promise.all([
    pool.query(baseQuery, params),
    pool.query(countQuery, categoryId ? [categoryId] : []),
  ]);

  const total = parseInt(countResult.rows[0].count);

  const posts = postResult.rows.map((post) => ({
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

  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
    posts,
  };
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

export async function updatePostBySlug(
  slug: string,
  updates: {
    title?: string;
    newSlug?: string;
    content?: string;
    imageUrl?: string | null;
    categoryIds?: number[];
  }
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const postResult = await client.query(
      `
      UPDATE posts SET
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        content = COALESCE($3, content),
        image_url = COALESCE($4, image_url)
      WHERE slug = $5
      RETURNING id, title, slug, content, image_url, created_at
      `,
      [updates.title, updates.newSlug, updates.content, updates.imageUrl, slug]
    );

    const post = postResult.rows[0];

    if (!post) {
      await client.query("ROLLBACK");
      return null;
    }

    if (updates.categoryIds) {
      await client.query("DELETE FROM post_categories WHERE post_id = $1", [
        post.id,
      ]);

      for (const categoryId of updates.categoryIds) {
        await client.query(
          `
          INSERT INTO post_categories (post_id, category_id) VALUES ($1, $2)
          `,
          [post.id, categoryId]
        );
      }
    }

    await client.query("COMMIT");
    return post;
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error("Failed to update post");
  } finally {
    client.release();
  }
}

export async function deletePostBySlug(slug: string) {
  const result = await pool.query(
    `
     DELETE FROM posts WHERE slug = $1
     RETURNING id, title, slug
    `,
    [slug]
  );

  if (result.rows.length === 0) {
    throw new Error("Post not found");
  }

  return result.rows[0];
}
