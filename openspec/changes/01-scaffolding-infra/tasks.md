# Tasks: 01 — Scaffolding & Infra

## 1. Workspace Bootstrap
_Commit: `chore: init pnpm monorepo workspace and root tooling`_

- [x] 1.1 Create `pnpm-workspace.yaml` (apps/*, packages/*) and root `package.json` (engines node 22.x/pnpm 9.x, `packageManager`, root scripts). _(Deviation: engines `>=22`/`>=9` + exact `packageManager: pnpm@10.13.1` — host runs node 24/pnpm 10.)_
- [x] 1.2 Add `.nvmrc` (`22`), `.gitignore`, `.env.example` (DB URLs, ports, secrets), `README.md` (setup steps). _(Deviation: template shipped as `env.example` — tooling policy blocks writing `.env*` paths; README documents the copy step.)_
- [x] 1.3 Add root `tsconfig.base.json`, `eslint.config.mjs` (flat config), `.prettierrc` (+ `.prettierignore`).
- [x] 1.4 Verify: `pnpm install` succeeds from clean clone with no shell-specific errors. _(Verified: install, `pnpm lint`, `pnpm format` all green.)_

## 2. Docker & Database
_Commit: `chore: add docker-compose with postgres dev and test databases`_

- [x] 2.1 Create `docker-compose.yml` (postgres:16, healthcheck) and `docker/init-db.sql` creating `twitter_dev` + `twitter_test`.
- [x] 2.2 Verify: `docker compose up -d` then confirm both DBs reachable on configured ports. _(Verified: pg_isready OK, both DBs listed, TCP reachable on host port — local uses `POSTGRES_PORT=5433` because 5432 is taken by WSL relay.)_
- [x] 2.3 Document `docker compose down -v` in README as the fix for stale volumes on re-init.

## 3. Shared Types Package
_Commit: `feat(shared): add shared types package`_

- [x] 3.1 Create `packages/shared/package.json` (`@twitterclone/shared`, `exports` → `./src`) and `src/index.ts` (e.g. `HealthStatus` type).
- [x] 3.2 Add as workspace dependency in `apps/api` and `apps/web` package.json. _(Completed within groups 4 and 6 when each app's package.json was created.)_
- [x] 3.3 Risk check: confirm Jest, Vitest, and `tsc --noEmit` all resolve `@twitterclone/shared` before relying on it downstream. _(Verified: ts-jest e2e compile, Vitest runtime import of `APP_NAME` in App shell, and `tsc --noEmit` in both apps all resolve it.)_

## 4. API Scaffold + Prisma
_Commit: `feat(api): scaffold nestjs app with health check endpoint` then `feat(api): add prisma schema and initial migration`_

- [x] 4.1 Scaffold NestJS 11 app: `apps/api/src/main.ts`, `app.module.ts`.
- [x] 4.2 Add `health/health.controller.ts` — `GET /health` returns `{status:'ok'}`.
- [x] 4.3 Verify: app boots locally, `curl /health` returns 200. _(Verified on port 3210 — host port 3000 was taken by an unrelated local process; `API_PORT` env controls it.)_
- [x] 4.4 Write `apps/api/prisma/schema.prisma`: `User`, `Tweet`, `Follow`, `Like` per design (self-relation replies, composite `@@id`s, `Tweet(authorId, createdAt)` index).
- [x] 4.5 Run `prisma migrate dev --name init` against `twitter_dev`; commit generated SQL. _(Migration `20260701203825_init`; `Tweet_authorId_createdAt_idx` confirmed in SQL.)_
- [x] 4.6 Verify: `prisma migrate deploy` applies cleanly against empty `twitter_test`. _(Verified: all migrations applied.)_

## 5. API Test Infra
_Commit: `test(api): add jest+supertest health e2e and coverage gate`_

- [x] 5.1 Add `jest.config.ts` scoped coverage (`src/**/*.ts`, exclude `*.module.ts`, `main.ts`, `*.dto.ts`, `.spec.ts`, generated Prisma), threshold 85%.
- [x] 5.2 Write `test/health.e2e-spec.ts` — Supertest `GET /health` against full Nest app + `twitter_test`.
- [x] 5.3 Verify: `pnpm --filter api test` passes, coverage meets 85% on scaffolding code. _(Verified: 1/1 pass, coverage 100% stmts/branch/funcs/lines.)_ Risk: recheck scope on first CI run once feature code lands.

## 6. Web Scaffold + Test Infra
_Commit: `feat(web): scaffold vite react tailwind app shell`_ then _`test(web): add vitest smoke test`_

- [x] 6.1 Scaffold Vite+React18+Tailwind in `apps/web` — `App.tsx` renders minimal shell. _(Verified: typecheck + vite build green, Tailwind CSS emitted.)_
- [x] 6.2 Add `vitest.config.ts` (jsdom) and `App.test.tsx` smoke test asserting shell renders without errors.
- [x] 6.3 Verify: `pnpm --filter web test` passes. _(Verified: 1/1 pass. Includes `APP_NAME` runtime export in shared so Vitest genuinely resolves the workspace package.)_

## 7. CI Pipeline
_Commit: `ci: add github actions lint, typecheck and test workflow`_

- [ ] 7.1 Add `.github/workflows/ci.yml`: install (pnpm cache), `postgres:16` service, lint, `tsc --noEmit`, `migrate deploy`, test (both workspaces).
- [ ] 7.2 Verify: push triggers CI green; a temporary local lint violation confirms the job fails, then revert.

## 8. Post-Scaffolding Follow-Up (orchestrator-owned)

- [ ] 8.1 Re-detect testing capabilities and update engram `sdd-init/twitterclone` (test_runner, layers, coverage → installed/found).
- [ ] 8.2 Flip `strict_tdd: true`/`apply.tdd: true` in `openspec/config.yaml`; update `testing` block to installed state.
