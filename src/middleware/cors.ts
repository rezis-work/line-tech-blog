import { IncomingMessage, ServerResponse } from "http";

export function cors(req: IncomingMessage, res: ServerResponse) {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://tech-gazzeta.vercel.app",
    "https://www.tech-gazzeta.vercel.app",
  ];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}
