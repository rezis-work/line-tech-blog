import pool from "../config/db";

export async function createComment(
  userId: number,
  postId: number,
  content: string
) {
  const result = await pool.query(
    `
    INSERT INTO comments (user_id, post_id, content)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, post_id, content, created_at
    `,
    [userId, postId, content]
  );

  return result.rows[0];
}

export async function getCommentsByPostId(postId: number) {
  const result = await pool.query(
    `
    SELECT
     c.id, c.content, c.created_at, u.id as user_id, u.name as user_name
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = $1
    ORDER BY c.created_at DESC
    `,
    [postId]
  );

  return result.rows.map((comment) => ({
    id: comment.id,
    content: comment.content,
    createdAt: comment.created_at,
    user: {
      id: comment.user_id,
      name: comment.user_name,
    },
  }));
}

export async function deleteCommentAsAdminOrOwner(
  commentId: number,
  userId: number,
  userRole: string
) {
  if (userRole === "admin") {
    const result = await pool.query(
      `
      DELETE FROM comments c
      USING posts p
      WHERE c.id = $1
      AND c.post_id = p.id
      AND p.author_id = $2
      RETURNING id
      `,
      [commentId, userId]
    );

    return result.rows[0];
  } else {
    const result = await pool.query(
      `
      DELETE FROM comments
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [commentId, userId]
    );

    return result.rows[0];
  }
}
