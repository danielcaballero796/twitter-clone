# Proposal: 01 — Scaffolding & Infra

## Intent

Greenfield foundation for the Twitter Clone hiring challenge. Evaluators read the commit history and expect the first commits to be scaffolding. This change produces a runnable, testable, CI-verified monorepo skeleton — no features — so every later change (starting with auth) builds on proven test runners and a complete data model. Maps to rubric: **Proceso 15% / Testing 25% (infra) / Docs 10% / Bonus 5% (Docker day 1)**.

## Scope

### In Scope
- `git init`, `.gitignore`, README skeleton, `.env.example`
- pnpm workspaces: `apps/api` (NestJS 11), `apps/web` (Vite+React18+Tailwind), `packages/shared`
- `docker-compose.yml`: Postgres 16 dev + separate `twitter_test` DB
- Complete Prisma schema (User, Tweet w/ nullable `parentId`, Follow, Like — unique constraints + `(authorId, createdAt)` index) + first migration
- Test infra proven: Jest+Supertest (api, coverage gate 85%), Vitest+Testing Library (web) + one smoke test each
- ESLint + Prettier + `tsc --noEmit`
- GitHub Actions CI: lint + test on push
- Commit `openspec/` and `.atl/` as AI-process evidence

### Out of Scope
- Any feature endpoint/UI beyond health check + app shell (auth is change 02)
- Seed data, argon2, JWT guard (later changes)

## Approach

Single-language TS monorepo via pnpm workspaces. NestJS domain-module layout, Prisma as ORM against dockerized Postgres. Smoke tests exist solely to VERIFY runners work end-to-end (green CI = trustworthy TDD from change 02 on). Cross-platform npm scripts only (Windows 11 host, evaluators on Mac/Linux).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `/` root | New | pnpm-workspace.yaml, package.json, docker-compose, CI, .env.example |
| `apps/api` | New | NestJS app + Jest/Supertest + Prisma schema/migration |
| `apps/web` | New | Vite+React+Tailwind + Vitest smoke test |
| `packages/shared` | New | Shared TS types package |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Runbook fails on clean/Mac machine | Med | Docker from day 1; dry-run day 3 |
| Coverage gate blocks trivial scaffolding | Med | Scope coverage to real source; smoke tests pass gate |
| Cross-platform script breakage | Med | No shell-specific commands; pnpm scripts only |

## Rollback Plan

Pre-first-commit: `rm -rf` generated dirs. Post-commit: `git reset --hard` to prior tag or `git revert` the scaffolding commits — no runtime state to unwind since no features/data exist.

## Dependencies

- Node 22, pnpm, Docker Desktop on host
- GitHub public repo created

## Success Criteria

- [ ] `pnpm install` + `docker compose up` boots Postgres (dev + test)
- [ ] `pnpm test` green for api (Jest) and web (Vitest); coverage config enforces 85%
- [ ] `prisma migrate` applies full schema; `tsc --noEmit` + lint clean
- [ ] GitHub Actions runs lint + test green on push
- [ ] First commits are scaffolding, conventional, no squash
