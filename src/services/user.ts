import pool from "../config/db";

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
}
