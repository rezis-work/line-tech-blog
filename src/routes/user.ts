import { IncomingMessage, ServerResponse } from "http";
import { getPostsByUserId } from "../services/user";
import { handleApiError } from "../utils/error";

export async function handleUserRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path.match(/^\/users\/\d+\/posts$/)) {
    const userId = parseInt(path.split("/")[2]);

    try {
      const posts = await getPostsByUserId(userId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ posts }));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch posts");
      return true;
    }
  }

  return false;
}
