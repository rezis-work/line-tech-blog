import { IncomingMessage, ServerResponse } from "http";
import pool from "../config/db";
import { handleApiError } from "../utils/error";
import { getBloggerProfileById } from "../services/blogger";

export async function handleBloggerRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path.startsWith("/bloggers/")) {
    const id = parseInt(path.split("/")[2]);

    try {
      const profile = await getBloggerProfileById(id);
      if (!profile) {
        handleApiError(res, "Blogger not found", 404);
        return true;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(profile));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  return false;
}
