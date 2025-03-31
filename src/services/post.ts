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

export async function getAllPosts(
  categoryId?: number,
  page = 1,
  limit = 5,
  query?: string
) {
  const offset = (page - 1) * limit;
  let baseQuery = `
    SELECT
      p.id, p.title, p.slug, p.content, p.image_url, p.created_at,
      u.id AS author_id, u.name AS author_name
    FROM posts p
    JOIN users u ON p.author_id = u.id
  `;

  let countQuery = `
    SELECT COUNT(DISTINCT p.id) 
    FROM posts p
    JOIN users u ON p.author_id = u.id
  `;

  const params: (string | number)[] = [];
  let paramIndex = 1;

  const whereClauses: string[] = [];

  if (categoryId) {
    baseQuery += ` JOIN post_categories pc ON pc.post_id = p.id`;
    countQuery += ` JOIN post_categories pc ON pc.post_id = p.id`;
    whereClauses.push(`pc.category_id = $${paramIndex}`);
    params.push(categoryId);
    paramIndex++;
  }

  if (query) {
    whereClauses.push(
      `(p.title ILIKE $${paramIndex} OR p.content ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`
    );
    params.push(`%${query}%`);
    paramIndex++;
  }

  if (whereClauses.length > 0) {
    baseQuery += ` WHERE ${whereClauses.join(" AND ")}`;
    countQuery += ` WHERE ${whereClauses.join(" AND ")}`;
  }

  baseQuery += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${
    paramIndex + 1
  }`;
  params.push(limit, offset);

  try {
    const [postResult, countResult] = await Promise.all([
      pool.query(baseQuery, params),
      pool.query(countQuery, params.slice(0, paramIndex - 1)),
    ]);

    const total = parseInt(countResult.rows[0].count);

    const posts = postResult.rows.map((post) => ({
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

    return {
      page,
      limit,
      total,
      hasMore: total > offset + limit,
      posts,
    };
  } catch (err) {
    console.error("Error fetching posts:", err);
    throw new Error("Failed to fetch posts");
  }
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
