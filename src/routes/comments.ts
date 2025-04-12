import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { parseBody } from "../utils/parseBody";
import { handleApiError } from "../utils/error";
import {
  createComment,
  deleteCommentAsAdminOrOwner,
  getCommentsByPostId,
  updateCommentById,
} from "../services/comment";
import { getUserFromRequest } from "../middleware/auth";
import { createNotification } from "../services/notification";
import pool from "../config/db";
import { getPostById } from "../services/post";

export async function handleCommentRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "POST" && path.startsWith("/comments/")) {
    const user = await getUserFromRequest(req);
    if (!user) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    const postId = parseInt(path.split("/")[2]);

    try {
      const { content } = await parseBody(req);
      if (!content || content.trim() === "") {
        handleApiError(res, "Content is required", 400);
        return true;
      }

      const comment = await createComment(user.id, postId, content.trim());
      const post = await getPostById(postId);

      if (post && post.author_id !== user.id) {
        await createNotification(
          post.author_id,
          "comment",
          `${user.name} commented on your post`,
          postId
        );
      }
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(comment));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  if (req.method === "GET" && path.startsWith("/comments/")) {
    const postId = parseInt(path.split("/")[2]);

    try {
      const comments = await getCommentsByPostId(postId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(comments));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  if (req.method === "DELETE" && path.startsWith("/comments/")) {
    const user = await getUserFromRequest(req);
    if (!user) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    const commentId = parseInt(path.split("/")[2]);

    try {
      const deleted = await deleteCommentAsAdminOrOwner(
        commentId,
        user.id,
        user.role
      );
      if (!deleted) {
        handleApiError(res, "Comment not found or not authorized", 404);
        return true;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(deleted));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  if (req.method === "PUT" && path.match(/^\/comments\/\d+$/)) {
    const user = await getUserFromRequest(req);
    if (!user) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    const commentId = parseInt(path.split("/")[2]);

    try {
      const body = await parseBody(req);
      if (
        !body.content ||
        typeof body.content !== "string" ||
        body.content.trim() === ""
      ) {
        handleApiError(res, "Content is required", 400);
        return true;
      }

      const updatedComment = await updateCommentById(
        commentId,
        user.id,
        body.content
      );
      if (!updatedComment) {
        handleApiError(res, "Comment not found or not authorized", 404);
        return true;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(updatedComment));
      return true;
    } catch (error) {
      handleApiError(res, error, 500, "Failed to update comment");
      return true;
    }
  }

  if (
    req.method === "POST" &&
    path.startsWith("/comments/") &&
    path.includes("/reply")
  ) {
    const user = await getUserFromRequest(req);
    if (!user) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    const segments = path.split("/");
    const parentCommentId = parseInt(segments[2]);
    const postId = parseInt(segments[4]);

    try {
      const { content } = await parseBody(req);
      if (!content || content.trim() === "") {
        handleApiError(res, "Content is required", 400);
        return true;
      }

      const reply = await createComment(
        user.id,
        postId,
        content.trim(),
        parentCommentId
      );

      const parentCommentUser = await pool.query(
        `
        SELECT user_id FROM comments WHERE id = $1
        `,
        [parentCommentId]
      );

      if (
        parentCommentUser.rows.length > 0 &&
        parentCommentUser.rows[0].user_id !== user.id
      ) {
        await createNotification(
          parentCommentUser.rows[0].user_id,
          "reply",
          `${user.name} replied to your comment`,
          postId,
          parentCommentId
        );
      }

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reply));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to create reply");
      return true;
    }
  }

  return false;
}
