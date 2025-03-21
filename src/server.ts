import dotenv from "dotenv";
import http from "http";
import { handleAuthRoutes } from "./routes/auth";

dotenv.config();

const PORT = process.env.PORT || 3000;

export function startServer() {
  const server = http.createServer(async (req, res) => {
    await handleAuthRoutes(req, res);
  });

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
