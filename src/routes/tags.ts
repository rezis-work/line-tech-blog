import { IncomingMessage, ServerResponse } from "http";
import { findOrCreateTag, getTags, getTrendingTags } from "../services/tag";
import { handleApiError } from "../utils/error";
import { parseBody } from "../utils/parseBody";

export async function handleTagRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/trending-tags") {
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

  if (req.method === "GET" && path === "/tags") {
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

  if (req.method === "POST" && path === "/find-or-create") {
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

  return false;
}
