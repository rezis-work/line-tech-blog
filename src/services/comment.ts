import pool from "../config/db";

export async function createComment(
  userId: number,
  postId: number,
  content: string,
  parentCommentId?: number
) {
  const result = await pool.query(
    `
    INSERT INTO comments (user_id, post_id, content, parent_comment_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, post_id, content, created_at
    `,
    [userId, postId, content, parentCommentId || null]
  );

  return result.rows[0];
}

export async function getCommentsByPostId(postId: number) {
  const { rows } = await pool.query(
    `
    SELECT
     c.id, c.content, c.created_at, c.parent_comment_id, u.id as user_id, u.name as user_name
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = $1
    ORDER BY c.created_at ASC
    `,
    [postId]
  );

  const comments: Record<number, any> = {};
  const topLevelComments: any[] = [];

  for (const row of rows) {
    const comment = {
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      user: {
        id: row.user_id,
        name: row.user_name,
        imageUrl: row.user_image_url,
      },
      replies: [],
    };

    comments[comment.id] = comment;

    if (row.parent_comment_id) {
      if (comments[row.parent_comment_id]) {
        comments[row.parent_comment_id].replies.push(comment);
      } else {
        comments[row.parent_comment_id] = { replies: [comment] };
      }
    } else {
      topLevelComments.push(comment);
    }
  }

  return topLevelComments;
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

export async function updateCommentById(
  commentId: number,
  userId: number,
  newContent: string
) {
  const result = await pool.query(
    `
    UPDATE comments
    SET content = $1
    WHERE id = $2 AND user_id = $3
    RETURNING id, content, created_at
    `,
    [newContent, commentId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error("Comment not found or not authorized");
  }

  return result.rows[0];
}
