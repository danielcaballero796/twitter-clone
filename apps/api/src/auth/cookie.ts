import type { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Shared cookie attributes for both setting (login) and clearing (logout) the session cookie. */
export function buildAccessTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  };
}
