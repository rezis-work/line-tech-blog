import { IncomingMessage, ServerResponse } from "http";
import { getTrendingTags } from "../services/tag";
import { handleApiError } from "../utils/error";

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

  return false;
}
