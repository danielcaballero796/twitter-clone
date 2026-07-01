/**
 * Shared contract types consumed by both apps/api and apps/web.
 * This package is consumed as TypeScript source (no build step).
 */

/** Application display name — single source of truth for both apps. */
export const APP_NAME = 'Twitter Clone';

/** Payload returned by `GET /health`. */
export interface HealthStatus {
  status: 'ok';
}

/** Authenticated user shape returned by the API — never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string;
}

/** Body accepted by `POST /auth/register`. */
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

/** Body accepted by `POST /auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
}
