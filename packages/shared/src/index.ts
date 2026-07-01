/**
 * Shared contract types consumed by both apps/api and apps/web.
 * This package is consumed as TypeScript source (no build step).
 */

/** Payload returned by `GET /health`. */
export interface HealthStatus {
  status: 'ok';
}
