export function createCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    secure?: boolean;
    path?: string;
  } = {}
) {
  let cookie = `${name}=${value}`;

  // Defaults
  const path = options.path ?? "/";
  const sameSite = options.sameSite ?? "Strict";
  const httpOnly = options.httpOnly ?? true;

  cookie += `; Path=${path}`;
  if (httpOnly) cookie += `; HttpOnly`;
  cookie += `; SameSite=${sameSite}`;
  if (options.secure) cookie += `; Secure`;
  if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;

  return cookie;
}
