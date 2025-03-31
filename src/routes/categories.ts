import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { handleApiError } from "../utils/error";
import { createCategory, getAllCategories } from "../services/category";
import { getUserFromRequest } from "../middleware/auth";
import { parseBody } from "../utils/parseBody";
import { getAllPosts } from "../services/post";

export async function handleCategoryRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/categories") {
    try {
      const categories = await getAllCategories();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(categories));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 500, "Failed to fetch categories");
      return true;
    }
  }

  if (req.method === "POST" && path === "/categories") {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== "admin") {
      handleApiError(res, "Forbidden", 403, "Forbidden");
      return true;
    }

    try {
      const { name } = await parseBody(req);
      const category = await createCategory(name);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(category));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 400, "Failed to create category");
      return true;
    }
  }

  if (req.method === "GET" && path.match(/^\/categories\/\d+\/posts$/)) {
    const categoryId = parseInt(path.split("/")[2]);
    const page = parseInt(parsedUrl.searchParams.get("page") || "1");
    const limit = parseInt(parsedUrl.searchParams.get("limit") || "5");

    try {
      const result = await getAllPosts(categoryId, page, limit);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    } catch (err) {
      handleApiError(res, `${err}`, 500, "Failed to fetch posts");
      return true;
    }
  }

  return false;
}
