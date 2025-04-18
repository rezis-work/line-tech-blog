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
  const searchParams = parsedUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '8');

  if (req.method === "GET" && path.startsWith("/bloggers/")) {
    const id = parseInt(path.split("/")[2]);

    try {
      const profile = await getBloggerProfileById(id, page, limit);
      if (!profile) {
        handleApiError(res, "Blogger not found", 404);
        return true;
      }
      const { rows } = await pool.query(
        `SELECT COUNT(*) FROM posts WHERE author_id = $1`,
        [id]
      );
      const totalCount = parseInt(rows[0].count);
      const totalPages = Math.ceil(totalCount / limit);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...profile, totalPages, totalCount }));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  return false;
}
