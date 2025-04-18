import bcrypt from "bcryptjs";
import crypto from "crypto-js";

import pool from "../config/db";
import { refreshPostsSearchView } from "./search";
export async function getPostsByUserId(userId: number) {
  const result = await pool.query(
    `
    SELECT 
      p.id,
      p.title,
      p.slug,
      p.image_url,
      p.created_at
    FROM posts p
    WHERE p.author_id = $1
    ORDER BY p.created_at DESC
    `,
    [userId]
  );

  return result.rows.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    image_url: post.image_url,
    created_at: post.created_at,
  }));
}

export async function updateUserProfile(
  userId: number,
  name?: string,
  imageUrl?: string,
  email?: string
) {
  const result = await pool.query(
    `
    UPDATE users
    SET
     name = COALESCE($1, name),
     image_url = COALESCE($2, image_url),
     email = COALESCE($3, email)
    WHERE id = $4
    RETURNING id, name, email, image_url
    `,
    [name, imageUrl, email, userId]
  );

  return result.rows[0];
}

export async function updateAdminProfile(
  userId: number,
  updates: {
    name?: string;
    coverImageUrl?: string;
    imageUrl?: string;
    email?: string;
    bio?: string;
    facebookUrl?: string;
    twitterUrl?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
  }
) {
  await pool.query(
    `
    UPDATE users
    SET
     name = COALESCE($1, name),
     cover_image_url = COALESCE($2, cover_image_url),
     bio = COALESCE($3, bio),
     image_url = COALESCE($4, image_url),
     email = COALESCE($5, email),
     facebook_url = COALESCE($6, facebook_url),
     twitter_url = COALESCE($7, twitter_url),
     instagram_url = COALESCE($8, instagram_url),
     linkedin_url = COALESCE($9, linkedin_url)
    WHERE id = $10
    RETURNING id, name, cover_image_url, image_url, bio, facebook_url, twitter_url, instagram_url, linkedin_url
    `,
    [
      updates.name,
      updates.coverImageUrl,
      updates.bio,
      updates.imageUrl,
      updates.email,
      updates.facebookUrl,
      updates.twitterUrl,
      updates.instagramUrl,
      updates.linkedinUrl,
      userId,
    ]
  );

  await refreshPostsSearchView();
}

export async function getUserProfile(userId: number) {
  const { rows } = await pool.query(
    `
    SELECT id, name, email, role, image_url, bio, cover_image_url, facebook_url, twitter_url, instagram_url, linkedin_url
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("User not found");
  }

  return rows[0];
}

export async function updateMyProfile(
  userId: number,
  role: string,
  updates: {
    name?: string;
    imageUrl?: string;
    email?: string;
    bio?: string;
    coverImageUrl?: string;
    facebookUrl?: string;
    twitterUrl?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
  }
) {
  if (role === "user" || role === "admin" || role === "holder") {
    const {
      name,
      email,
      imageUrl,
      bio,
      coverImageUrl,
      facebookUrl,
      twitterUrl,
      instagramUrl,
      linkedinUrl,
    } = updates;
    const result = await pool.query(
      `
      UPDATE users
      SET
       name = COALESCE($1, name),
       email = COALESCE($2, email),
       image_url = COALESCE($3, image_url),
       bio = COALESCE($4, bio),
       cover_image_url = COALESCE($5, cover_image_url),
       facebook_url = COALESCE($6, facebook_url),
       twitter_url = COALESCE($7, twitter_url),
       instagram_url = COALESCE($8, instagram_url),
       linkedin_url = COALESCE($9, linkedin_url)
      WHERE id = $10
      RETURNING id, name, email, image_url, bio, cover_image_url, facebook_url, twitter_url, instagram_url, linkedin_url
      `,
      [
        name,
        email,
        imageUrl,
        bio,
        coverImageUrl,
        facebookUrl,
        twitterUrl,
        instagramUrl,
        linkedinUrl,
        userId,
      ]
    );

    await refreshPostsSearchView();

    return result.rows[0];
  } else {
    throw new Error("Unauthorized role");
  }
}

export async function createAdmin(
  holderId: number,
  { name, email, password }: { name: string; email: string; password: string }
) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
    INSERT INTO users (name, email, password, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, role
    `,
    [name, email, hashedPassword, "admin"]
  );

  return result.rows[0];
}

export async function getPublicUserProfile(userId: number) {
  const { rows: userRows } = await pool.query(
    `
    SELECT id, name, image_url
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  if (userRows.length === 0) {
    throw new Error("User not found");
  }

  const user = userRows[0];

  const { rows: commentCount } = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM comments
      WHERE user_id = $1
      `,
    [userId]
  );

  const { rows: favoriteCount } = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM favorites
      WHERE user_id = $1
      `,
    [userId]
  );

  return {
    id: user.id,
    name: user.name,
    imageUrl: user.image_url,
    email: user.email,
    commentCount: parseInt(commentCount[0].count),
    favoriteCount: parseInt(favoriteCount[0].count),
  };
}

export async function changeUserPassword(
  userId: number,
  currentPassword: string,
  newPassword: string
) {
  const { rows } = await pool.query(
    `
    SELECT password FROM users
    WHERE id = $1
    `,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("User not found");
  }

  const user = rows[0];

  const isMatch = await bcrypt.compare(currentPassword, user.password);

  if (!isMatch) {
    throw new Error("Invalid current password");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await pool.query(
    `
      UPDATE users
      SET password = $1
      WHERE id = $2
      `,
    [hashedPassword, userId]
  );

  return true;
}

export async function generatePasswordResetToken(email: string) {
  const { rows } = await pool.query(
    `
    SELECT id FROM users WHERE email = $1
    `,
    [email]
  );

  if (rows.length === 0) {
    throw new Error("User not found");
  }

  const userId = rows[0].id;
  const token = crypto.lib.WordArray.random(32).toString(crypto.enc.Hex);
  const expiresAt = new Date(Date.now() + 3600 * 1000);

  await pool.query(
    `
    UPDATE users
    SET reset_token = $1, reset_token_expires_at = $2
    WHERE id = $3
    `,
    [token, expiresAt, userId]
  );

  return token;
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
) {
  const { rows } = await pool.query(
    `
    SELECT id, reset_token_expires_at
    FROM users
    `,
    [token]
  );

  if (rows.length === 0) {
    throw new Error("Invalid or expired token");
  }

  const user = rows[0];

  const expiresAt = new Date(user.reset_token_expires_at);

  if (expiresAt < new Date()) {
    throw new Error("Token expired");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await pool.query(
    `
    UPDATE users
    SET password = $1, reset_token = NULL, reset_token_expires_at = NULL
    WHERE id = $2
    `,
    [hashedPassword, user.id]
  );

  return true;
}
