import pool from "../config/db";
import { refreshPostsSearchView } from "./search";
import { addTagsToPost, clearTagsFromPost, getTagsForPost } from "./tag";

export async function createPost(
  title: string,
  slug: string,
  content: string,
  image_url: string | null,
  author_id: number,
  categoryIds: number[] = [],
  video_url: string | null = null,
  tagNames: string[] = []
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const postResult = await client.query(
      `
      INSERT INTO posts (title, slug, content, image_url, author_id, video_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, slug, content, image_url, author_id, video_url, created_at
      `,
      [title, slug, content, image_url, author_id, video_url]
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
    if (tagNames.length > 0) {
      await addTagsToPost(post.id, tagNames);
    }
    await refreshPostsSearchView();
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
  query?: string,
  sort?: "newest" | "popular" | "commented"
) {
  const offset = (page - 1) * limit;
  let baseQuery = `
    SELECT
      p.id, p.title, p.slug, p.content, p.image_url, p.created_at,
      u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
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
  let orderByClause = `ORDER BY p.created_at DESC`;

  if (categoryId) {
    baseQuery += ` JOIN post_categories pc ON pc.post_id = p.id`;
    countQuery += ` JOIN post_categories pc ON pc.post_id = p.id`;
    whereClauses.push(`pc.category_id = $${paramIndex}`);
    params.push(categoryId);
    paramIndex++;
  }

  if (sort === "popular") {
    orderByClause = `
     ORDER BY 
       (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) DESC
    `;
  } else if (sort === "commented") {
    orderByClause = `
     ORDER BY 
       (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) DESC
    `;
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

  baseQuery += ` ${orderByClause} LIMIT $${paramIndex} OFFSET $${
    paramIndex + 1
  }`;
  params.push(limit, offset);

  try {
    const [postResult, countResult] = await Promise.all([
      pool.query(baseQuery, params),
      pool.query(countQuery, params.slice(0, paramIndex - 1)),
    ]);

    const postIds = postResult.rows.map((p) => p.id);
    let categoriesByPostId: Record<number, number[]> = {};
    let favoriteCountByPostId: Record<number, number> = {};
    let commentCountByPostId: Record<number, number> = {};

    if (postIds.length > 0) {
      const placeholders = postIds.map((_, index) => `$${index + 1}`).join(",");
      const result = await pool.query(
        `
        SELECT pc.post_id, c.name as category_name
        FROM post_categories pc
        JOIN categories c ON pc.category_id = c.id
        WHERE pc.post_id IN (${placeholders})
        `,
        postIds
      );

      for (const row of result.rows) {
        if (!categoriesByPostId[row.post_id]) {
          categoriesByPostId[row.post_id] = [];
        }
        categoriesByPostId[row.post_id].push(row.category_name);
      }

      const favoriteResult = await pool.query(
        `
        SELECT post_id, COUNT(*) as count FROM favorites WHERE post_id IN (${placeholders}) GROUP BY post_id
        `,
        postIds
      );

      for (const row of favoriteResult.rows) {
        favoriteCountByPostId[row.post_id] = parseInt(row.count);
      }

      const commentResult = await pool.query(
        `
        SELECT post_id, COUNT(*) as count FROM comments WHERE post_id IN (${placeholders}) GROUP BY post_id
        `,
        postIds
      );

      for (const row of commentResult.rows) {
        commentCountByPostId[row.post_id] = parseInt(row.count);
      }
    }

    const posts = postResult.rows.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt:
        post.content.length > 200
          ? post.content.slice(0, 200) + "..."
          : post.content,
      image_url: post.image_url,
      created_at: post.created_at,
      author: {
        id: post.author_id,
        name: post.author_name,
        image_url: post.author_image_url,
      },
      categories: categoriesByPostId[post.id] || [],
      favorite_count: favoriteCountByPostId[post.id] || 0,
      comment_count: commentCountByPostId[post.id] || 0,
    }));

    const total = parseInt(countResult.rows[0].count);

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
      u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
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

  const categoriesResult = await pool.query(
    `
     SELECT c.id as category_id, c.name as category_name
     FROM post_categories pc
     JOIN categories c ON pc.category_id = c.id
     WHERE pc.post_id = $1
    `,
    [post.id]
  );

  const favoriteResult = await pool.query(
    `
    SELECT COUNT(*) as count FROM favorites WHERE post_id = $1
    `,
    [post.id]
  );

  const commentResult = await pool.query(
    `
    SELECT COUNT(*) as count FROM comments WHERE post_id = $1
    `,
    [post.id]
  );

  const favoriteCount = parseInt(favoriteResult.rows[0].count);
  const commentCount = parseInt(commentResult.rows[0].count);

  const category_names = categoriesResult.rows.map((row) => row.category_name);
  const tags = await getTagsForPost(post.id);

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    tags: tags.map((t) => t.name),
    content: post.content,
    image_url: post.image_url,
    created_at: post.created_at,
    author: {
      id: post.author_id,
      name: post.author_name,
      image_url: post.author_image_url,
    },
    category_names,
    favorite_count: favoriteCount,
    comment_count: commentCount,
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
    tagNames?: string[];
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

    if (updates.tagNames) {
      await clearTagsFromPost(post.id);
      await addTagsToPost(post.id, updates.tagNames);
    }

    await client.query("COMMIT");
    await refreshPostsSearchView();
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

export async function searchPosts(query: string, page = 1, limit = 5) {
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `
    SELECT
     p.id, p.title, p.slug, p.content, p.image_url, p.created_at,
     u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url,
     ts_rank_cd(ps.document, plainto_tsquery('english', $1)) AS rank
    FROM posts_search ps
    JOIN posts p ON ps.post_id = p.id
    JOIN users u ON p.author_id = u.id
    WHERE ps.document @@ plainto_tsquery('english', $1)
    ORDER BY rank DESC, p.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [query, limit, offset]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt:
      row.content.length > 200
        ? row.content.slice(0, 200) + "..."
        : row.content,
    image_url: row.image_url,
    created_at: row.created_at,
    author: {
      id: row.author_id,
      name: row.author_name,
      image_url: row.author_image_url,
    },
  }));
}
