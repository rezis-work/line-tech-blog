import { IncomingMessage, ServerResponse } from "http";
import {
  deleteTag,
  findOrCreateTag,
  getTags,
  getTrendingTags,
} from "../services/tag";
import { handleApiError } from "../utils/error";
import { parseBody } from "../utils/parseBody";
import { createRateLimiter } from "../config/ratelimiter";

const limiter = createRateLimiter({ limit: 60, windowSeconds: 60 });

export async function handleTagRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/api/trending-tags") {
    const { success } = await limiter(req.socket.remoteAddress ?? "unknown");
    if (!success)
      return handleApiError(res, "Too many requests, try again later", 429);
    try {
      const tags = await getTrendingTags();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(tags));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch trending tags");
      return true;
    }
  }

  if (req.method === "GET" && path === "/api/tags") {
    const { success } = await limiter(req.socket.remoteAddress ?? "unknown");
    if (!success)
      return handleApiError(res, "Too many requests, try again later", 429);
    try {
      const tags = await getTags();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(tags));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch tags");
      return true;
    }
  }

  if (req.method === "POST" && path === "/api/find-or-create") {
    try {
      const body = await parseBody(req);
      if (!body.name) {
        handleApiError(res, "Missing required fields", 400);
        return true;
      }
      const tags = await findOrCreateTag(body.name);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(tags));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to find or create tag");
      return true;
    }
  }

  if (req.method === "DELETE" && path.startsWith("/api/tags/")) {
    const tagId = path.split("/")[3];
    const { success } = await limiter(req.socket.remoteAddress ?? "unknown");
    if (!success) {
      handleApiError(res, "Too many requests, try again later", 429);
      return true;
    }
    try {
      const result = await deleteTag(parseInt(tagId));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to delete tag");
      return true;
    }
  }

  return false;
}
