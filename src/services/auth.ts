import pool from "../config/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function registerUser(
  name: string,
  email: string,
  password: string,
  role?: string
) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
    [name, email, hashedPassword, "user"]
  );
  return result.rows[0];
}

export async function loginUser(email: string, password: string) {
  const result = await pool.query(
    "SELECT id, email, password, role FROM users WHERE email = $1",
    [email]
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error("Invalid email or password");
  }

  const accessToken = jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  const refreshToken = jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [user.id, refreshToken, expiresAt]
  );

  return { accessToken, refreshToken, user };
}

export async function refreshAccessToken(refreshToken: string) {
  let decoded: any;
  try {
    decoded = jwt.verify(refreshToken, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid refresh token");
  }

  const userId = decoded.userId;

  const result = await pool.query(
    "SELECT * FROM refresh_tokens WHERE user_id = $1 AND token = $2",
    [userId, refreshToken]
  );

  const storedToken = result.rows[0];
  if (!storedToken) {
    throw new Error("Refresh token not found");
  }

  const now = new Date();
  if (new Date(storedToken.expires_at) < now) {
    throw new Error("Refresh token expired");
  }

  const newAccessToken = jwt.sign(
    {
      userId: userId,
      role: decoded.role,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { accessToken: newAccessToken };
}

export async function logoutUser(refreshToken: string) {
  await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [
    refreshToken,
  ]);

  return { message: "Logged out successfully" };
}
