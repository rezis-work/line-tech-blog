export function createCookie(
  name: string,
  value: string,
  options: { maxAge?: number } = {}
) {
  const isProduction = process.env.NODE_ENV === "production";
  let cookie = `${name}=${value}; Path=/; HttpOnly; SameSite=Strict`;

  if (options.maxAge) {
    cookie += `; Max-Age=${options.maxAge}`;
  }

  if (isProduction) {
    cookie += "; Secure";
  }

  return cookie;
}
