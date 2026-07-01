# Design: 01 — Scaffolding & Infra

## Technical Approach

Single-language TS pnpm monorepo. Three workspaces: `apps/api` (NestJS 11), `apps/web` (Vite+React18), `packages/shared` (types). Prisma against dockerized Postgres 16 with a separate test DB. Jest+Supertest and Vitest+Testing Library proven by smoke tests so change 02 inherits a green TDD loop. GitHub Actions runs lint+typecheck+test on push. Everything cross-platform (pnpm scripts only, no shell-specific commands).

## Architecture Decisions

| Decision | Options | Choice + Rationale |
|----------|---------|--------------------|
| Monorepo tool | pnpm workspaces / Turborepo / Nx | **pnpm workspaces** — zero extra tooling, fastest install, enough for 3 packages. Turbo/Nx = premature complexity for a 72h challenge. |
| Shared types consumption | published pkg / TS path alias / workspace `dependency` | **workspace dep `@twitterclone/shared` + `tsconfig` project ref**; apps import from package name. No build step needed if consumed as source via `exports` → `./src`. |
| Version pinning | .nvmrc / Volta / engines only | **All three**: `engines` (node `22.x`, pnpm `9.x`) + `.nvmrc` (`22`) + root `packageManager` field. Runbook needs exact, reproducible versions cross-machine. |
| Postgres topology | 1 container/2 DBs / 2 containers | **1 container, 2 databases** (`twitter_dev`, `twitter_test`) via `docker-entrypoint-initdb.d` init script. One healthcheck, less RAM, simpler compose. Test isolation is by DB name, not container. |
| Test DB creation | migrate on boot / init SQL / app bootstrap | **init SQL** creates empty `twitter_test`; CI/local run `prisma migrate deploy` against it before tests. Keeps schema single-sourced in Prisma. |
| Prisma migration flow | `db push` / `migrate dev` (local) + `migrate deploy` (CI) | **`migrate dev` locally** (generates versioned SQL = commit evidence), **`migrate deploy` in CI/test** (no drift, no prompts). |
| Coverage scope | all files / source-only | **source-only**: collect from `src/**/*.ts`, exclude `*.module.ts`, `main.ts`, `*.dto.ts`, `.spec.ts`, generated Prisma. Prevents boilerplate from gaming the 85% gate. |
| Lint/format | ESLint flat + Prettier / Biome | **ESLint flat config (`eslint.config.mjs`) at root, shared**, + Prettier. Flat config is the NestJS 11 / modern default; one config, per-app overrides. |
| CI Postgres | service container / docker-compose in CI | **GH Actions `services: postgres:16`** — native, cached, healthchecked; compose reserved for local dev/runbook. |

## Data Flow

```
docker compose up ─→ postgres:16 (init.sql → twitter_dev + twitter_test)
                          │
pnpm --filter api migrate ├─→ prisma migrate deploy → schema applied
                          │
pnpm test ────────────────┴─→ api: Jest+Supertest (twitter_test)  → coverage ≥85%
                               web: Vitest+RTL (jsdom)             → smoke green
CI (push) ─→ install → lint → tsc --noEmit → migrate deploy → test
```

## File Changes (all Create)

| File | Description |
|------|-------------|
| `pnpm-workspace.yaml`, root `package.json`, `.nvmrc`, `.gitignore`, `.env.example`, `README.md` | Workspace + version + env skeleton |
| `docker-compose.yml`, `docker/init-db.sql` | Postgres 16 + dual-DB init |
| `eslint.config.mjs`, `.prettierrc`, root `tsconfig.base.json` | Shared quality toolchain |
| `apps/api/**` | NestJS: `main.ts`, `app.module.ts`, `health/health.controller.ts` (`GET /health` → `{status:'ok'}`), `prisma/schema.prisma`, first migration, `jest.config.ts`, `test/health.e2e-spec.ts` |
| `apps/web/**` | Vite+React18+Tailwind shell (`App.tsx` app skeleton), `vitest.config.ts`, `App.test.tsx` smoke |
| `packages/shared/**` | `package.json` (`@twitterclone/shared`), `src/index.ts` exported types |
| `.github/workflows/ci.yml` | lint + typecheck + test w/ Postgres service, pnpm cache |

## Interfaces / Contracts

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  username     String   @unique
  passwordHash String
  displayName  String
  bio          String?
  createdAt    DateTime @default(now())
  tweets    Tweet[]
  following Follow[] @relation("follower")
  followers Follow[] @relation("following")
  likes     Like[]
}
model Tweet {
  id        String   @id @default(cuid())
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  String
  content   String   @db.VarChar(280)
  parent    Tweet?   @relation("replies", fields: [parentId], references: [id], onDelete: Cascade)
  parentId  String?
  replies   Tweet[]  @relation("replies")
  likes     Like[]
  createdAt DateTime @default(now())
  @@index([authorId, createdAt(sort: Desc)])
  @@index([parentId])
}
model Follow {
  follower    User     @relation("follower", fields: [followerId], references: [id], onDelete: Cascade)
  followerId  String
  following   User     @relation("following", fields: [followingId], references: [id], onDelete: Cascade)
  followingId String
  createdAt   DateTime @default(now())
  @@id([followerId, followingId])
  @@index([followingId])
}
model Like {
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  tweet     Tweet    @relation(fields: [tweetId], references: [id], onDelete: Cascade)
  tweetId   String
  createdAt DateTime @default(now())
  @@id([userId, tweetId])
  @@index([tweetId])
}
```

`packages/shared` exports enums/DTO-shape types (e.g. `HealthStatus`) consumed by both apps.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (api) | placeholder service | Jest — proves runner + coverage collection |
| Integration/E2E (api) | `GET /health` | Supertest over full Nest app against `twitter_test` |
| Unit (web) | App shell renders | Vitest + Testing Library + jsdom |
| CI gate | lint, `tsc --noEmit`, coverage ≥85% on scoped source | GH Actions, fail-fast |

## Migration / Rollout

First migration = full schema (`init`). No data migration (greenfield). Pre-commit rollback: delete generated dirs. Post-commit: `git revert` scaffolding commits — no runtime state.

## Commit Sequence

1. `chore: init pnpm monorepo workspace and root tooling` (workspace, tsconfig, eslint, prettier, gitignore, env.example, nvmrc)
2. `chore: add docker-compose with postgres dev and test databases`
3. `feat(shared): add shared types package`
4. `feat(api): scaffold nestjs app with health check endpoint`
5. `feat(api): add prisma schema and initial migration`
6. `test(api): add jest+supertest health e2e and coverage gate`
7. `feat(web): scaffold vite react tailwind app shell`
8. `test(web): add vitest smoke test`
9. `ci: add github actions lint, typecheck and test workflow`

## Open Questions

- None blocking. `argon2` / JWT deferred to change 02 by scope.
