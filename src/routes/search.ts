import { IncomingMessage, ServerResponse } from "http";
import { searchPosts } from "../services/post";
import { handleApiError } from "../utils/error";

export async function handleSearchRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedURL = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedURL.pathname;

  if (req.method === "GET" && path === "/search") {
    const query = parsedURL.searchParams.get("query");

    if (!query || query.trim() === "") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Query parameter is required" }));
      return true;
    }

    try {
      const posts = await searchPosts(query);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(posts));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }
  return false;
}
