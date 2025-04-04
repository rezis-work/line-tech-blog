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

  return false;
}
