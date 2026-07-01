import { config } from 'dotenv';

// Load apps/api/.env if present (local dev), then force tests onto the test DB.
config();

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/twitter_test';
