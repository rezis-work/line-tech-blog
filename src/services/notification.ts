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

export async function markNotificationsAsRead(
  notificationId: number,
  userId: number
) {
  const { rows } = await pool.query(
    `
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = $1 AND user_id = $2
    `,
    [notificationId, userId]
  );

  return rows[0];
}

export async function getUnreadNotificationCount(userId: number) {
  const { rows } = await pool.query(
    `
    SELECT COUNT(*) FROM notifications
    WHERE user_id = $1 AND is_read = FALSE
    `,
    [userId]
  );

  return parseInt(rows[0].count, 10);
}

export async function clearAllNotifications(userId: number) {
  await pool.query(
    `
    DELETE FROM notifications
    WHERE user_id = $1
    `,
    [userId]
  );

  return true;
}
