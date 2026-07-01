# Twitter Clone

Minimal Twitter-like app built as a hiring challenge. pnpm monorepo:

| Package           | Stack                                        |
| ----------------- | -------------------------------------------- |
| `apps/api`        | NestJS 11 + Prisma + PostgreSQL 16           |
| `apps/web`        | React 18 + Vite + Tailwind                   |
| `packages/shared` | Shared TypeScript types (consumed as source) |

## Prerequisites

- Node.js >= 22 (`.nvmrc` provided — `nvm use`)
- pnpm >= 9 (`corepack enable` picks the pinned version from `packageManager`)
- Docker Desktop (for PostgreSQL)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Environment: copy the template
#    - root .env        → variables for docker-compose (ports/credentials)
#    - apps/api/.env    → variables for the API (DATABASE_URL, etc.)
cp env.example .env
cp env.example apps/api/.env

# 3. Start PostgreSQL (creates twitter_dev + twitter_test databases)
docker compose up -d

# 4. Apply database migrations
pnpm --filter api exec prisma migrate deploy

# 5. Run the API (http://localhost:3000/health)
pnpm --filter api start:dev

# 6. Run the web app (http://localhost:5173)
pnpm --filter web dev
```

> If port 5432 is already taken on your machine, set `POSTGRES_PORT` in the root
> `.env` (used by docker-compose) and update the URLs in `apps/api/.env`.

## Scripts (root)

| Script           | What it does                                       |
| ---------------- | -------------------------------------------------- |
| `pnpm lint`      | ESLint over the whole repo                         |
| `pnpm format`    | Prettier check (`pnpm format:write` to fix)        |
| `pnpm typecheck` | `tsc --noEmit` in every workspace                  |
| `pnpm test`      | All test suites (API: Jest+Supertest, Web: Vitest) |
| `pnpm build`     | Build every workspace                              |

## Testing

- **API**: Jest + Supertest against a real Postgres test DB (`twitter_test`), coverage gate 85%.
- **Web**: Vitest + Testing Library (jsdom).

```bash
pnpm --filter api test   # requires docker compose up -d + migrated twitter_test
pnpm --filter web test
```
