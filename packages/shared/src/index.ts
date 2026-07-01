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
