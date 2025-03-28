import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { handleApiError } from "../utils/error";
import { createCategory, getAllCategories } from "../services/category";
import { getUserFromRequest } from "../middleware/auth";
import { parseBody } from "../utils/parseBody";

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

  return false;
}
