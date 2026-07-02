# Twitter Clone

Minimal Twitter-like app built as a hiring challenge. pnpm monorepo:

| Package           | Stack                                        |
| ----------------- | -------------------------------------------- |
| `apps/api`        | NestJS 11 + Prisma + PostgreSQL 16           |
| `apps/web`        | React 18 + Vite + Tailwind                   |
| `packages/shared` | Shared TypeScript types (consumed as source) |

## Prerequisites

- **Docker** (Engine or Desktop) with Compose v2 — the only requirement for the quick start below.
- Node.js >= 22 (`.nvmrc` provided — `nvm use`) and pnpm >= 9 (`corepack enable` picks the pinned version from `packageManager`) — only needed for native dev mode.

## Quick start (Docker — reviewer path)

One command boots the whole product: postgres, the API (migrated), and the web app, behind a single origin.

```bash
docker compose up -d --build
```

Open **http://localhost:8080** (or `http://localhost:${WEB_PORT}` if overridden below). No `.env` file is required — every variable has a working default on a clean checkout, and migrations run automatically before the API starts listening.

nginx serves the built SPA and reverse-proxies `/auth`, `/users`, `/tweets`, `/notifications` and `/health` to the api container — one origin, no CORS, first-party session cookie. (`/notifications` doubles as a SPA route: nginx splits on the `Accept` header — browser navigations get the app shell, JSON fetches reach the API.)

Seed the running stack with the same deterministic demo dataset described below:

```bash
docker compose exec api npx ts-node prisma/seed.ts
```

Override the host port without rebuilding any image (either inline or via the root `.env`):

```bash
WEB_PORT=3005 docker compose up -d
```

Tear down:

```bash
docker compose down       # stop and remove containers
docker compose down -v    # also drop the postgres volume (fresh state next boot)
```

## Native dev mode (hot reload)

Prefer this path when developing: hot reload on both apps, source-consumed `@twitterclone/shared`, CORS configured for `localhost:5173`. Docker here is only used for PostgreSQL.

```bash
# 1. Install dependencies
pnpm install

# 2. Environment: copy the template into the two places that read it
#    - root .env        → read by docker-compose (POSTGRES_*, WEB_PORT)
#    - apps/api/.env    → read by the API via dotenv (DATABASE_URL, JWT_SECRET, etc.)
#    The web app needs NO .env in dev: VITE_API_URL defaults to http://localhost:3000.
cp .env.example .env
cp .env.example apps/api/.env

# 3. Start PostgreSQL (creates twitter_dev + twitter_test databases)
docker compose up -d postgres

# 4. Apply database migrations
pnpm --filter api exec prisma migrate deploy

# 5. Run the API (http://localhost:3000/health)
pnpm --filter api start:dev

# 6. Run the web app (http://localhost:5173)
pnpm --filter web dev
```

> If port 5432 is already taken on your machine, set `POSTGRES_PORT` in the root
> `.env` (used by docker-compose) and update the URLs in `apps/api/.env`.

> **Stale volume after re-init?** The `docker/init-db.sql` script only runs on an
> empty volume. If the databases are missing or in a bad state, reset with
> `docker compose down -v` and start again with `docker compose up -d postgres`.

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
pnpm --filter api test   # requires docker compose up -d postgres + migrated twitter_test
pnpm --filter web test
```

## Demo data

Populate a fresh database with a fixed, deterministic demo dataset (8 users, 20 follows, 49 tweets including a reply thread, 60 likes, 6 notifications) so you can log in and immediately exercise timeline pagination, follows, likes, threads, and notifications. In native dev mode:

```bash
pnpm --filter @twitterclone/api db:seed
```

Running the dockerized stack instead? See the `docker compose exec api npx ts-node prisma/seed.ts` command in the quick start above.

Every seeded user shares the same demo password: `Flock123!`

| Username    |
| ----------- |
| `ada`       |
| `linus`     |
| `grace`     |
| `margaret`  |
| `alan`      |
| `barbara`   |
| `dennis`    |
| `katherine` |

Log in as `ada@theflock.dev` / `Flock123!` to see a timeline that spans multiple pages (she follows 5 of the other seeded users), a reply thread on her latest tweet, and a notifications bell with 3 unread items.

Re-running the seed wipes existing seed-owned data (likes, follows, tweets, users) before inserting again, so it always converges to the same dataset. The script refuses to run when `NODE_ENV=production`.

## Architecture & key decisions

### Stack rationale

One language (TypeScript) across the whole stack: shared types between API and client (`packages/shared`, consumed as source), maximum iteration speed, and the stack where execution quality is easiest to prove.

- **NestJS 11 + Node 22** — opinionated domain-module structure, native DI, first-class testing ecosystem (Jest + Supertest).
- **Prisma + PostgreSQL 16** — declarative schema, versioned migrations (evolution visible in the commit history), end-to-end type safety. All data access goes through a single injected `PrismaService`; the only raw SQL in the codebase is the health check's `SELECT 1`.
- **React 18 + Vite + TanStack Query + Tailwind CSS v4** — server-cache invalidation solved by the query layer, mobile-first styling, class-based dark mode.

### Backend layout

Domain modules (`auth`, `users`, `tweets`, `follows`, `likes`, `notifications`, `health`), each with controller → service → `PrismaService`. DTOs validated with `class-validator` (global `ValidationPipe` with `whitelist` + `transform`). A global JWT guard protects everything by default; public routes opt out with a `@Public()` decorator. There is deliberately no separate repository layer: Prisma Client is already a typed data-access abstraction, and services are the single point of contact with it — extracting repository interfaces later is a mechanical refactor.

### Auth

- Passwords hashed with **argon2id**; registration input length-capped (`@MaxLength`) so hashing cost can't be abused.
- **JWT in an httpOnly, SameSite=Lax cookie** (never localStorage — XSS). 7-day expiry, no refresh rotation: a documented challenge-scope trade-off.
- The API refuses to boot without `JWT_SECRET`.

### Timeline

- **Fan-out on read** (pull model): tweets are queried by the author set at read time, backed by a composite index `(authorId, createdAt DESC)`. At this scale pre-computed timelines (fan-out on write) would be premature complexity.
- **Cursor pagination** (`createdAt` + `id` tiebreaker), not offset: stable under new inserts, no duplicated pages. The web app consumes it with `useInfiniteQuery` and optimistic updates for like/follow/delete.

### Counters

**Count on read** via Prisma `_count` — correct by construction, no drift. At real scale these would be denormalized with reconciliation jobs; not needed here.

### Data model notes

`Tweet.parentId` (nullable self-reference) shipped in the initial schema, so the reply-threads feature landed without a disruptive migration — replies are ordinary tweets that also appear in the timeline, with thread pages at `/t/:id`. `Follow` and `Like` use composite primary keys with supporting indexes for the reverse lookups.

### Notifications

Like, reply, and follow fan out **on write** into a persistent `Notification` row for the affected user (self-actions never notify — enforced in one place, `NotificationsService.create`). Undo is symmetric: unlike/unfollow delete their notification, and cascade FKs clean up when the referenced tweet or user goes away. The web app shows an unread badge in the nav (TanStack Query) and marks everything read when the `/notifications` page is visited. Real-time push is the natural next layer (SSE) — persistence deliberately shipped first.

### Avatars

Deterministic DiceBear SVGs — the username is the seed, and a per-user `avatarStyle` column (whitelisted in `packages/shared`, picker on the own profile page) selects the collection. No upload flow or binary storage by design; profile name and bio are editable via `PATCH /users/me`.

### Theme system

Class-based dark mode (Tailwind v4 `@custom-variant`), toggled by a `useTheme` hook: defaults to `prefers-color-scheme`, persists explicit choices to localStorage, reacts to OS changes while in system mode, and an inline pre-hydration script in `index.html` prevents any flash of the wrong theme.

## Trade-offs consciously taken

- Single-column, breakpoint-less layout (Twitter-like center feed) instead of a multi-column desktop shell.
- CSRF relies on SameSite=Lax cookies (plus origin-restricted CORS in native dev mode; the Docker stack is single-origin, so CORS doesn't apply); no double-submit token layer.
- No rate limiting or security-header middleware (helmet/throttler) — first items on a production hardening list.
- Registration errors are surfaced as coarse messages rather than per-field validation feedback.

## AI tooling

Built with **Claude Code** using a spec-driven workflow: each change was planned (proposal → specs → design → task breakdown, archived under `openspec/`), implemented with strict TDD by sub-agents, independently verified against its specs, and the final delivery passed a two-round adversarial review (two blind reviewers in parallel, confirmed findings fixed and re-judged). The human drove every scope, architecture and trade-off decision; the commit history reflects the feature-by-feature progression.
