import { IncomingMessage } from "http";
import { parseCookies } from "../utils/parseCookies";
import { verifyToken } from "../utils/jwt";
import pool from "../config/db";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export async function getUserFromRequest(
  req: IncomingMessage
): Promise<User | null> {
  try {
    const cookies = parseCookies(req);
    const token = cookies.accessToken || cookies.token;

    if (!token) return null;
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return null;
    }

    const result = await pool.query(
      "SELECT id, name, email, role, image_url FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (!result.rows.length) return null;

    return result.rows[0];
  } catch {
    return null;
  }
}
