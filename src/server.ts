import dotenv from "dotenv";
import http from "http";
import { handleAuthRoutes } from "./routes/auth";
import { handlePostRoutes } from "./routes/posts";
import { handleApiError } from "./utils/error";

dotenv.config();

const PORT = process.env.PORT || 3000;

export function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      res.setHeader("Content-Type", "application/json");

      const authHandled = await handleAuthRoutes(req, res);
      if (authHandled) {
        return;
      }

      const postHandled = await handlePostRoutes(req, res);
      if (postHandled) {
        return;
      }

      handleApiError(res, "Not Found", 404);
    } catch (error) {
      console.error("Server error:", error);
      handleApiError(res, "error", 500);
    }
  });

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
