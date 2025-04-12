import pool from "../config/db";

export async function createNotification(
  userId: number,
  type: string,
  message: string,
  postId?: number,
  commentId?: number
) {
  await pool.query(
    `
    INSERT INTO notifications (user_id, type, message, post_id, comment_id)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, type, message, postId || null, commentId || null]
  );
}

export async function getUserNotifications(userId: number) {
  const result = await pool.query(
    `
    SELECT id, type, message, post_id, comment_id, is_read, created_at
    FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

export async function markNotificationsAsRead(notificationId: number) {
  await pool.query(
    `
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = $1
    `,
    [notificationId]
  );
}
