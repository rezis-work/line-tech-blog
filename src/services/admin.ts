import pool from "../config/db";

export async function getGlobalDashboardStats() {
  const [
    postResult,
    userResult,
    commentResult,
    favoriteResult,
    postsWeekResult,
    usersWeekResult,
    commentsWeekResult,
  ] = await Promise.all([
    pool.query(`
      SELECT COUNT(*) FROM posts
    `),
    pool.query(`
      SELECT COUNT(*) FROM users
    `),
    pool.query(`
      SELECT COUNT(*) FROM comments
    `),
    pool.query(`
      SELECT COUNT(*) FROM favorites
    `),
    pool.query(`
      SELECT COUNT(*) FROM posts
      WHERE created_at >= NOW() - INTERVAL '1 week'
    `),
    pool.query(`
      SELECT COUNT(*) FROM users
      WHERE created_at >= NOW() - INTERVAL '1 week'
    `),
    pool.query(`
      SELECT COUNT(*) FROM comments
      WHERE created_at >= NOW() - INTERVAL '1 week'
    `),
  ]);

  return {
    totalPosts: parseInt(postResult.rows[0].count),
    totalUsers: parseInt(userResult.rows[0].count),
    totalComments: parseInt(commentResult.rows[0].count),
    totalFavorites: parseInt(favoriteResult.rows[0].count),
    postsWeek: parseInt(postsWeekResult.rows[0].count),
    usersWeek: parseInt(usersWeekResult.rows[0].count),
    commentsWeek: parseInt(commentsWeekResult.rows[0].count),
  };
}

export async function getAdminDashboardStats(adminId: number) {
  const [
    postResult,
    commentResult,
    favoriteResult,
    postsWeekResult,
    commentsWeekResult,
  ] = await Promise.all([
    pool.query(
      `
       SELECT COUNT(*) FROM posts p
       WHERE p.author_id = $1
      `,
      [adminId]
    ),
    pool.query(
      `
       SELECT COUNT(*) FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE p.author_id = $1
      `,
      [adminId]
    ),
    pool.query(
      `
         SELECT COUNT(*) FROM favorites f
         JOIN posts p ON f.post_id = p.id
         WHERE p.author_id = $1
        `,
      [adminId]
    ),
    pool.query(
      `
       SELECT COUNT(*) FROM posts WHERE author_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
      `,
      [adminId]
    ),
    pool.query(
      `
       SELECT COUNT(*) FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE p.author_id = $1 AND c.created_at >= NOW() - INTERVAL '7 days'
      `,
      [adminId]
    ),
  ]);

  return {
    totalPosts: parseInt(postResult.rows[0].count),
    totalComments: parseInt(commentResult.rows[0].count),
    totalFavorites: parseInt(favoriteResult.rows[0].count),
    postsWeek: parseInt(postsWeekResult.rows[0].count),
    commentsWeek: parseInt(commentsWeekResult.rows[0].count),
  };
}

export async function getGlobalAnalyticsData() {
  const [postResult, userResult, commentResult] = await Promise.all([
    pool.query(`
      SELECT 
       TO_CHAR(created_at, 'YYYY-MM') AS MONTH,
       COUNT(*) AS count
       FROM posts
       GROUP BY month
       ORDER BY month ASC
      `),
    pool.query(`
        SELECT 
         TO_CHAR(created_at, 'YYYY-MM') AS MONTH,
         COUNT(*) AS count
         FROM users
         GROUP BY month
         ORDER BY month ASC
        `),
    pool.query(`
          SELECT 
           TO_CHAR(created_at, 'YYYY-MM') AS MONTH,
           COUNT(*) AS count
           FROM comments
           GROUP BY month
           ORDER BY month ASC
        `),
  ]);

  return {
    posts: postResult.rows,
    users: userResult.rows,
    comments: commentResult.rows,
  };
}

export async function getAdminPersonalAnalytics(adminId: number) {
  const [postResult, commentResult, favoriteResult] = await Promise.all([
    pool.query(
      `
      SELECT 
       TO_CHAR(created_at, 'YYYY-MM') AS MONTH,
       COUNT(*) AS count
       FROM posts
       WHERE author_id = $1
       GROUP BY month
       ORDER BY month ASC
      `,
      [adminId]
    ),
    pool.query(
      `
       SELECT 
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        COUNT(*) AS count
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE p.author_id = $1
       GROUP BY month
       ORDER BY month ASC
      `,
      [adminId]
    ),
    pool.query(
      `
      SELECT 
       TO_CHAR(created_at, 'YYYY-MM') AS month,
       COUNT(*) AS count
       FROM favorites f
       JOIN posts p ON f.post_id = p.id
       WHERE p.author_id = $1
       GROUP BY month
       ORDER BY month ASC
      `,
      [adminId]
    ),
  ]);

  return {
    posts: postResult.rows,
    comments: commentResult.rows,
    favorites: favoriteResult.rows,
  };
}

export async function getReportedPosts(page: number, limit: number) {
  const offset = (page - 1) * limit;
  
  const countResult = await pool.query(`
    SELECT COUNT(*) 
    FROM reports r
    WHERE r.post_id IS NOT NULL
  `);
  
  const result = await pool.query(`
    SELECT 
     r.id AS report_id,
     p.id AS post_id,
     p.title,
     p.slug,
     r.reason,
     r.created_at,
     u.id AS user_id,
     u.name AS user_name
    FROM reports r
    JOIN posts p ON r.post_id = p.id
    JOIN users u ON r.user_id = u.id
    WHERE r.post_id IS NOT NULL
    ORDER BY r.created_at DESC
    LIMIT $1 OFFSET $2
    `, [limit, offset]);

  const total = parseInt(countResult.rows[0].count);
  
  return {
    reports: result.rows,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total
  };
}

export async function getReportedComments() {
  const result = await pool.query(`
    SELECT 
     r.id AS report_id,
     c.id AS comment_id,
     c.content,
     c.created_at,
     r.reason,
     r.created_at,
     u.id AS user_id,
     u.name AS user_name
    FROM reports r
    JOIN comments c ON r.comment_id = c.id
    JOIN users u ON r.user_id = u.id
    WHERE r.comment_id IS NOT NULL
    ORDER BY r.created_at DESC
  `);

  return result.rows;
}

export async function deletePost(postId: number) {
  await pool.query(
    `
    DELETE FROM posts WHERE id = $1
    `,
    [postId]
  );
}

export async function deleteComment(commentId: number) {
  await pool.query(
    `
    DELETE FROM comments WHERE id = $1
    `,
    [commentId]
  );
}
