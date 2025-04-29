import { IncomingMessage, ServerResponse } from "http";

const requestCounts: Record<string, { count: number; lastReset: number }> = {};

const MAX_REQUESTS = 1000000000;
const WINDOW_SIZE = 15 * 60 * 1000;

export function rateLimiter(
  req: IncomingMessage,
  res: ServerResponse
): boolean {
  const ip = req.socket.remoteAddress || "unknown";

  const now = Date.now();

  if (!requestCounts[ip]) {
    requestCounts[ip] = { count: 1, lastReset: now };
    return false;
  }

  const data = requestCounts[ip];

  if (now - data.lastReset > WINDOW_SIZE) {
    requestCounts[ip] = { count: 1, lastReset: now };
    return false;
  }

  data.count++;

  if (data.count > MAX_REQUESTS) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Too many requests" }));
    return true;
  }

  return false;
}
