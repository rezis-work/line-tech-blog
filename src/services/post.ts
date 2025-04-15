import pool from "../config/db";
import {
  invalidateBestByCategory,
  invalidateTrendingPosts,
} from "./cacheService";
import { refreshPostsSearchView } from "./search";
import { addTagsToPost, clearTagsFromPost, getTagsForPost } from "./tag";

export async function createPost(
  title: string,
  slug: string,
  content: string,
  image_url: string | null = null,
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
      await invalidateBestByCategory(categoryId.toString());
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
    await invalidateTrendingPosts();
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
  sort?: "newest" | "popular" | "commented",
  tagName?: string
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

  if (tagName) {
    baseQuery += ` JOIN post_tags pt ON pt.post_id = p.id JOIN tags t ON pt.tag_id = t.id`;
    countQuery += ` JOIN post_tags pt ON pt.post_id = p.id JOIN tags t ON pt.tag_id = t.id`;
    whereClauses.push(`t.name = $${paramIndex}`);
    params.push(tagName.toLowerCase());
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
    let tagsByPostId: Record<number, string[]> = {};

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

      const tagsResult = await pool.query(
        `
         SELECT pt.post_id, t.name as tag_name
         FROM post_tags pt
         JOIN tags t ON pt.tag_id = t.id
         WHERE pt.post_id IN (${placeholders})
        `,
        postIds
      );

      for (const row of tagsResult.rows) {
        if (!tagsByPostId[row.post_id]) {
          tagsByPostId[row.post_id] = [];
        }
        tagsByPostId[row.post_id].push(row.tag_name);
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
      tags: tagsByPostId[post.id] || [],
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
      p.id, p.title, p.slug, p.content, p.image_url, p.created_at, p.video_url,
      u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url, u.bio AS author_bio
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
    video_url: post.video_url,
    created_at: post.created_at,
    author: {
      id: post.author_id,
      name: post.author_name,
      image_url: post.author_image_url,
      bio: post.author_bio,
    },
    category_names,
    favorite_count: favoriteCount,
    comment_count: commentCount,
  };
}

export async function getPostById(id: number) {
  const result = await pool.query(
    `
    SELECT
     p.id, p.title, p.slug, p.content, p.image_url, p.created_at, p.video_url,
     u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url, u.bio AS author_bio
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = $1
    `,
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error("Post not found");
  }

  return result.rows[0];
}

export async function updatePostBySlug(
  slug: string,
  updates: {
    title?: string;
    newSlug?: string;
    content?: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
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
        image_url = COALESCE($4, image_url),
        video_url = COALESCE($5, video_url)
      WHERE slug = $6
      RETURNING id, title, slug, content, image_url, video_url, created_at
      `,
      [
        updates.title,
        updates.newSlug,
        updates.content,
        updates.imageUrl,
        updates.videoUrl,
        slug,
      ]
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
        await invalidateBestByCategory(categoryId.toString());
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
    await invalidateTrendingPosts();
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const postResult = await client.query(
      `
      SELECT id FROM posts WHERE slug = $1
      `,
      [slug]
    );

    if (postResult.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("Post not found");
    }

    const postId = postResult.rows[0].id;

    const categoriesResult = await client.query(
      `
      SELECT category_id FROM post_categories WHERE post_id = $1
      `,
      [postId]
    );

    const categoryIds = categoriesResult.rows.map((row) => row.category_id);

    await client.query("DELETE FROM post_categories WHERE post_id = $1", [
      postId,
    ]);

    await client.query("DELETE FROM posts WHERE id = $1", [postId]);

    await client.query("COMMIT");

    await invalidateTrendingPosts();

    for (const categoryId of categoryIds) {
      await invalidateBestByCategory(categoryId.toString());
    }

    return postId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error("Failed to delete post");
  } finally {
    client.release();
  }
}

export async function searchPosts(query: string, page = 1, limit = 5) {
  const offset = (page - 1) * limit;
  let results: any[] = [];

  const fullTextResult = await pool.query(
    `
    SELECT
     p.id, p.title, p.slug, p.content, p.image_url, p.created_at,
     u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url,
     ts_rank_cd(ps.document, to_tsquery('english', $1 || ':*')) AS rank
    FROM posts_search ps
    JOIN posts p ON ps.post_id = p.id
    JOIN users u ON p.author_id = u.id
    WHERE ps.document @@ to_tsquery('english', $1 || ':*')
    ORDER BY rank DESC, p.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [query, limit, offset]
  );

  results = fullTextResult.rows;

  if (results.length === 0) {
    const fallbackResult = await pool.query(
      `
       SELECT
        p.id, p.title, p.slug, p.content, p.image_url, p.created_at,
        u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
       FROM posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.title ILIKE $1 OR p.content ILIKE $1 OR u.name ILIKE $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3
      `,
      [`%${query}%`, limit, offset]
    );

    results = fallbackResult.rows;
  }

  return results.map((row) => ({
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

export async function getPostsWithVideos() {
  const result = await pool.query(`
    SELECT p.id, p.title, p.slug, p.image_url, p.created_at, p.video_url,
    u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.video_url IS NOT NULL
    ORDER BY p.created_at DESC
    LIMIT 20
    `);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    image_url: row.image_url,
    video_url: row.video_url,
    created_at: row.created_at,
    author: {
      id: row.author_id,
      name: row.author_name,
      image_url: row.author_image_url,
    },
  }));
}

export async function getRelatedPosts(postId: number, limit = 2) {
  const { rows: tagCategoryRows } = await pool.query(
    `
     SELECT 
      t.id AS tag_id,
      c.id AS category_id
     FROM posts p
     LEFT JOIN post_tags pt ON p.id = pt.post_id
     LEFT JOIN tags t ON pt.tag_id = t.id
     LEFT JOIN post_categories pc ON p.id = pc.post_id
     LEFT JOIN categories c ON pc.category_id = c.id
     WHERE p.id = $1
    `,
    [postId]
  );

  const tagIds = tagCategoryRows.map((row) => row.tag_id).filter(Boolean);
  const categoryIds = tagCategoryRows
    .map((row) => row.category_id)
    .filter(Boolean);

  if (tagIds.length === 0 && categoryIds.length === 0) {
    const { rows } = await pool.query(
      `
      SELECT id, title, slug, image_url, created_at
      FROM posts
      WHERE id != $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [postId, limit]
    );

    return rows;
  }

  const tagPlaceholders = tagIds.map((_, index) => `$${index + 2}`).join(",");
  const catPlaceholders = categoryIds
    .map((_, index) => `$${index + 2 + tagIds.length}`)
    .join(",");

  const queryParams = [postId, ...tagIds, ...categoryIds];

  const { rows: relatedPosts } = await pool.query(
    `
     SELECT DISTINCT p.id, p.title, p.slug, p.image_url, p.created_at,
     u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
     FROM posts p
     JOIN users u ON p.author_id = u.id
     LEFT JOIN post_tags pt ON p.id = pt.post_id
     LEFT JOIN post_categories pc ON p.id = pc.post_id
     WHERE p.id != $1
       AND (
        ${tagIds.length > 0 ? `pt.tag_id IN (${tagPlaceholders})` : ""}
        ${tagIds.length > 0 && categoryIds.length > 0 ? "OR" : ""}
        ${
          categoryIds.length > 0 ? `pc.category_id IN (${catPlaceholders})` : ""
        }
       )
     ORDER BY p.created_at DESC
     LIMIT ${limit}
    `,
    queryParams
  );

  return relatedPosts;
}

export async function getNextAndPrevPosts(slug: string) {
  const { rows: postRows } = await pool.query(
    `
     Select p.id, p.title, p.slug, p.created_at, p.image_url, p.content,
     u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
     FROM posts p
     JOIN users u ON p.author_id = u.id
     WHERE p.slug = $1
    `,
    [slug]
  );

  const currentPost = postRows[0];
  if (!currentPost) {
    return null;
  }

  const { id: postId, created_at: createdAt } = currentPost;

  const { rows: nextRows } = await pool.query(
    `
    SELECT p.id, p.title, p.slug, p.created_at, p.image_url, 
    u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE ((p.created_at > $1) OR (p.created_at = $1 AND p.id > $2)) AND p.slug != $3
    ORDER BY p.created_at ASC, p.id ASC
    LIMIT 1
    
    `,
    [createdAt, postId, slug]
  );

  const nextPost = nextRows[0];

  const { rows: prevRows } = await pool.query(
    `
    SELECT p.id, p.title, p.slug, p.created_at, p.image_url,
    u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE (p.created_at < $1) OR (p.created_at = $1 AND p.id < $2) AND p.id != $2
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 1

  `,
    [createdAt, postId]
  );

  const prevPost = prevRows[0];

  return {
    prev: prevPost,
    next: nextPost,
  };
}

export async function getPostsByTags(tags: string[], page = 1, limit = 5) {
  if (tags.length === 0) {
    throw new Error("No tags provided");
  }

  const offset = (page - 1) * limit;

  const tagPlaceholders = tags.map((_, index) => `$${index + 1}`).join(",");
  const limitPlaceholder = `$${tags.length + 1}`;
  const offsetPlaceholder = `$${tags.length + 2}`;
  const params: (string | number)[] = [
    ...tags.map((t) => t.toLowerCase()),
    limit,
    offset,
  ];

  const postsResult = await pool.query(
    `
    SELECT DISTINCT p.id, p.title, p.slug, p.image_url, p.created_at, p.content,
    u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
    FROM posts p
    JOIN users u ON p.author_id = u.id
    JOIN post_tags pt ON pt.post_id = p.id
    JOIN tags t ON pt.tag_id = t.id
    WHERE t.name IN (${tagPlaceholders})
    ORDER BY p.created_at DESC
    LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}

    `,
    params
  );

  const totalResult = await pool.query(
    `
     SELECT COUNT(DISTINCT p.id) AS count
     FROM posts p
     JOIN post_tags pt ON pt.post_id = p.id
     JOIN tags t ON pt.tag_id = t.id
     WHERE t.name IN (${tagPlaceholders})
    `,
    tags.map((t) => t.toLowerCase())
  );

  const posts = postsResult.rows.map((row) => ({
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

  const total = parseInt(totalResult.rows[0].count);

  return {
    page,
    limit,
    total,
    hasMore: total > offset + limit,
    posts,
  };
}
