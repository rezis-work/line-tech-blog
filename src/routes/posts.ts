import { IncomingMessage, ServerResponse } from "http";
import { parseBody } from "../utils/parseBody";
import { createPost } from "../services/post";
import { getUserFromRequest } from "../middleware/auth";
import { handleApiError } from "../utils/error";

export async function handlePostRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "POST" && path === "/posts") {
    const user = await getUserFromRequest(req);

    if (!user || user.role !== "admin") {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const { title, slug, content, image_url } = await parseBody(req);

      const post = await createPost(title, slug, content, image_url, user.id);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(post));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 400, "Failed to create post");
      return true;
    }
  }

  return false;
}
