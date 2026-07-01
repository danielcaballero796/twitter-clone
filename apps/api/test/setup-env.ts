import { config } from 'dotenv';

// Load apps/api/.env if present (local dev), then force tests onto the test DB.
config();

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/twitter_test';

// Ensure JWT signing works in tests even when no local .env is present.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
