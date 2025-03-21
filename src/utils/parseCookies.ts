import { IncomingMessage } from "http";

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie || "";
  const cookies: Record<string, string> = {};
  header.split(";").forEach((cookie) => {
    const [key, value] = cookie.split("=");
    if (key && value) cookies[key.trim()] = decodeURIComponent(value.trim());
  });
  return cookies;
}
