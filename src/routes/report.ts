import { IncomingMessage, ServerResponse } from "http";
import { getUserFromRequest } from "../middleware/auth";
import { handleApiError } from "../utils/error";
import { parseBody } from "../utils/parseBody";
import { reportComment, reportPost } from "../services/report";
import { getPostById } from "../services/post";
import { createNotification } from "../services/notification";
import pool from "../config/db";

export async function handleReportRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "POST" && path.startsWith("/api/reports/posts/")) {
    const postId = path.split("/")[4];
    const user = await getUserFromRequest(req);

    if (!user) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const body = await parseBody(req);
      const reason = body.reason;

      if (!reason) {
        handleApiError(res, "Reason is required", 400);
        return true;
      }

      await reportPost(user.id, parseInt(postId), reason);

      const post = await getPostById(parseInt(postId));

      if (post && post.author_id !== user.id) {
        await createNotification(
          post.author_id,
          "report",
          `${user.name} reported your post`,
          parseInt(postId)
        );
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Post reported successfully" }));
      return true;
    } catch (error) {
      handleApiError(res, "Failed to report post", 500);
      return true;
    }
  }

  if (req.method === "POST" && path.startsWith("/api/reports/comments/")) {
    const commentId = path.split("/")[4];
    const user = await getUserFromRequest(req);

    if (!user) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const body = await parseBody(req);
      const reason = body.reason;

      if (!reason) {
        handleApiError(res, "Reason is required", 400);
        return true;
      }

      await reportComment(user.id, parseInt(commentId), reason);

      const parentComment = await pool.query(
        `
        SELECT user_id FROM comments WHERE id = $1
        `,
        [parseInt(commentId)]
      );

      if (
        parentComment.rows.length > 0 &&
        parentComment.rows[0].user_id !== user.id
      ) {
        await createNotification(
          parentComment.rows[0].user_id,
          "report",
          "hidden user reported your comment",
          parseInt(commentId)
        );
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Comment reported successfully" }));
      return true;
    } catch (error) {
      handleApiError(res, "Failed to report comment", 500);
      return true;
    }
  }

  return false;
}
