import { IncomingMessage, ServerResponse } from "http";

export function cors(req: IncomingMessage, res: ServerResponse) {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://tech-gazzeta.vercel.app",
    "https://www.tech-gazzeta.vercel.app",
  ];

  const origin =
    req.headers.origin || (req.headers["Origin"] as string | undefined);

  // Always add Vary header for proxies (Heroku!)
  res.setHeader("Vary", "Origin");

  // Always set CORS (even if origin not allowed → safer)
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "null"); // prevents random browser caching
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight requests immediately
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}
