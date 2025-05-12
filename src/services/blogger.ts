import { cacheKey, getCache, setCache } from "../config/cache";
import pool from "../config/db";

export async function getBloggerProfileById(
  bloggerId: number,
  page = 1,
  limit = 10,
  sortParam: "newest" | "popular" | "commented" = "newest",
  tagName?: string
) {
  const key = cacheKey([
    "blogger",
    bloggerId.toString(),
    page.toString(),
    limit.toString(),
    sortParam,
    tagName ?? "none",
  ]);
  const cached = await getCache(key);
  if (cached) {
    return cached;
  }
  const userResult = await pool.query(
    `
    SELECT id, name, cover_image_url, image_url, bio, facebook_url, twitter_url, instagram_url, linkedin_url, created_at as register_day, email
    FROM users
    WHERE id = $1 AND role = 'admin'
    `,
    [bloggerId]
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  const offset = (page - 1) * limit;
  const params: (string | number)[] = [bloggerId];
  let whereClause = `author_id = $1`;

  if (tagName) {
    params.push(tagName.toLowerCase());
    whereClause += ` AND id IN (
      SELECT post_id FROM post_tags pt
      JOIN tags t ON pt.tag_id = t.id
      WHERE t.name = $2
    )`;
  }

  params.push(limit, offset);

  let orderByClause = "";
  switch (sortParam) {
    case "newest":
      orderByClause = "ORDER BY created_at DESC";
      break;
    case "popular":
      orderByClause =
        "ORDER BY (SELECT COUNT(*) FROM favorites WHERE post_id = posts.id) DESC, created_at DESC";
      break;
    case "commented":
      orderByClause =
        "ORDER BY (SELECT COUNT(*) FROM comments WHERE post_id = posts.id) DESC, created_at DESC";
      break;
    default:
      orderByClause = "ORDER BY created_at DESC";
  }

  const postsResult = await pool.query(
    `
    SELECT id, title, slug, image_url, created_at
    FROM posts
    WHERE ${whereClause}
    ${orderByClause}
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `,
    params
  );

  const postsIds = postsResult.rows.map((post) => post.id);

  let commentsCount: Record<number, number> = {};
  let favoritesCount: Record<number, number> = {};
  let tagsMap: Record<number, string[]> = {};

  if (postsIds.length > 0) {
    const placeholders = postsIds.map((_, index) => `$${index + 1}`).join(",");

    const commentsResult = await pool.query(
      `
      SELECT post_id, COUNT(*) AS count
      FROM comments
      WHERE post_id IN (${placeholders})
      GROUP BY post_id
      `,
      [...postsIds]
    );

    for (const row of commentsResult.rows) {
      commentsCount[row.post_id] = parseInt(row.count);
    }

    const favoritesResult = await pool.query(
      `
      SELECT post_id, COUNT(*) AS count
      FROM favorites
      WHERE post_id IN (${placeholders})
      GROUP BY post_id
      `,
      [...postsIds]
    );

    for (const row of favoritesResult.rows) {
      favoritesCount[row.post_id] = parseInt(row.count);
    }

    const tagsResult = await pool.query(
      `
       SELECT pt.post_id, t.name
       FROM post_tags pt
       JOIN tags t ON pt.tag_id = t.id
       WHERE pt.post_id IN (${placeholders})
      `,
      [...postsIds]
    );

    for (const row of tagsResult.rows) {
      if (!tagsMap[row.post_id]) {
        tagsMap[row.post_id] = [];
      }
      tagsMap[row.post_id].push(row.name);
    }
  }

  const posts = postsResult.rows.map((post) => ({
    ...post,
    commentsCount: commentsCount[post.id] || 0,
    favoritesCount: favoritesCount[post.id] || 0,
    tags: tagsMap[post.id] || [],
  }));

  const resultObj = {
    blogger: userResult.rows[0],
    posts,
    page,
    limit,
    hasMore: posts.length === limit,
  };

  await setCache(key, resultObj, 300);

  return resultObj;
}
