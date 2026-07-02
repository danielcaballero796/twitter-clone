# Proposal: 10-docker-fullstack — Run the whole stack with Docker Compose

## Intent

Complete the "Docker" bonus properly: `docker compose up -d --build` boots PostgreSQL, the API, and the web app — a reviewer needs Docker and nothing else (no Node, no pnpm, no manual migrations). One configurable host port (`WEB_PORT`, default 8080) so port collisions with other apps under review are a one-variable fix.

Along the way this change fixes a real latent bug: the API's production entry (`pnpm --filter api start`) has never worked — the script points at a path the build doesn't emit, and `@twitterclone/shared` exposes raw `.ts` that plain Node cannot load. Dev flows masked both.

## Rubric mapping

Bonus (5): Docker full-stack was pinned in the original plan as bonus #1. Funcionalidad (25): the runbook becomes one command — nothing to misconfigure. Calidad (20): fixes the broken production build honestly instead of papering over it in the image. Proceso (15): granular commits, CI smoke job proving `docker compose up` works on every push.

## Scope

### In Scope
- **Production-build fix**: `apps/api` start script → `node dist/main.js`; `packages/shared` resolvable by plain Node (extensionless `main`, compiled JS emitted only inside the image build).
- **`apps/api/Dockerfile`**: multi-stage (node:22-slim), pnpm workspace install, `prisma generate`, tsc build; runtime entry runs `prisma migrate deploy` before boot.
- **`apps/web/Dockerfile` + `docker/nginx.conf`**: Vite build with `VITE_API_URL=""` (relative URLs), nginx serves the SPA and proxies `/auth`, `/users`, `/tweets`, `/health` to the api service — single origin, no CORS, cookie is first-party.
- **`docker-compose.yml`**: adds `api` and `web` services with healthchecks and dependency ordering; only `web` must publish a host port (`WEB_PORT`); sane env defaults so `.env` is optional.
- **CI**: `docker-smoke` job — compose up --build, register/login through the proxy, health check.
- **README**: reviewer runbook (one command, one URL, seed via `docker compose exec`); dev mode unchanged and documented as such.

### Out of Scope
- Production hardening (TLS, secrets management, non-root users tuning beyond defaults, image size golf).
- Deploying anywhere; this is a local review experience.
- Hot-reload containers for development — dev keeps native pnpm + compose-for-Postgres.

## Approach

Same-origin topology (decided with the user after weighing a two-port alternative): the browser only ever talks to nginx, which serves static assets and reverse-proxies the API prefixes over the compose network. Relative API URLs mean the host port is never baked into an image — changing `WEB_PORT` requires no rebuild. Postgres keeps its host mapping for the dev workflow; the api service needs no host port at all.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/shared/package.json` | Modified | extensionless `main` (`src/index`), drop `exports` — dev tools keep resolving the `.ts` source, Node in the image resolves compiled `.js` |
| `apps/api/package.json` | Modified | `start` → `node dist/main.js` |
| `apps/api/Dockerfile` | New | multi-stage build + migrate-on-boot entry |
| `apps/web/Dockerfile`, `docker/nginx.conf` | New | static build + SPA fallback + API proxy |
| `docker-compose.yml` | Modified | `api` + `web` services, healthchecks, `WEB_PORT` |
| `.dockerignore` | New | keep node_modules/dist/.env out of build context |
| `.github/workflows/ci.yml` | Modified | `docker-smoke` job |
| `README.md` | Modified | Docker-first runbook; dev mode section |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Changing shared's `main` breaks a dev resolver (vitest/ts-jest/ts-node/vite) | Med | full lint+typecheck+test+dev smoke gate in the same commit as the change |
| Prisma engines missing/mismatched in the runtime image | Med | generate and run on the same base image (node:22-slim + openssl); healthcheck catches boot failures |
| Seed refuses to run in the container | Low | `NODE_ENV` deliberately left unset in compose (production guard stays for real deployments); seed documented via `docker compose exec` |
| Compose works on this machine but not CI | Med | `docker-smoke` CI job runs the same compose file headlessly on every push |

## Rollback Plan

Compose keeps the `postgres` service unchanged; reverting the feature commits restores today's DB-only compose. The shared/`start` fixes are independent, strictly-better commits with their own test gate — no reason to roll back with the rest.

## Dependencies

None new at runtime; images use node:22-slim and nginx:alpine. Docker Desktop / docker CLI for local verification and GitHub-hosted runners for CI.

## Success Criteria

- [ ] `docker compose up -d --build` from a clean checkout boots postgres → api (migrations applied) → web.
- [ ] `http://localhost:${WEB_PORT:-8080}` serves the app; register/login/tweet works end-to-end through the proxy; session cookie is first-party.
- [ ] `docker compose exec api npx ts-node prisma/seed.ts` populates demo data.
- [ ] `pnpm --filter @twitterclone/api build && node apps/api/dist/main.js` boots outside Docker too (bug actually fixed).
- [ ] Dev mode untouched: `docker compose up -d postgres` + `pnpm --filter api start:dev` + `pnpm --filter web dev` behave exactly as before.
- [ ] CI green including the new docker-smoke job; lint/typecheck/tests all pass.
