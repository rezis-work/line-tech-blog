import { IncomingMessage, ServerResponse } from "http";
import { handleApiError } from "../utils/error";
import { getTopPostsByCategory } from "../services/homepage";

export async function handleHomepageRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/homepage/top-by-category") {
    try {
      const result = await getTopPostsByCategory();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch top posts by category");
      return true;
    }
  }

  return false;
}
