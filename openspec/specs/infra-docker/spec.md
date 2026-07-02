# Docker Full-Stack Specification (infra)

## Purpose

Defines the containerized runbook: one `docker compose up -d --build` boots the entire product behind a single configurable host port, with migrations applied automatically. Also pins the production-build contract the containers depend on. 9 scenarios total.

## Requirements

### Requirement: One-Command Full Stack

`docker compose up -d --build` from a clean checkout MUST start postgres, the API (with migrations applied), and the web app, with no local Node/pnpm and no `.env` file required.

#### Scenario: Cold boot with defaults
- GIVEN a clean checkout on a machine with only Docker
- WHEN `docker compose up -d --build` runs
- THEN all three services MUST reach a healthy/running state and `http://localhost:8080` MUST serve the app

#### Scenario: Migrations applied on boot
- GIVEN an empty postgres volume
- WHEN the api container starts
- THEN it MUST run `prisma migrate deploy` before listening, and registration MUST succeed immediately afterwards

#### Scenario: Host port configurable without rebuild
- GIVEN port 8080 is occupied
- WHEN the stack is started with `WEB_PORT=8090`
- THEN the app MUST be fully functional on `http://localhost:8090` without rebuilding any image

### Requirement: Single Origin Behind the Proxy

The browser MUST interact with exactly one origin: nginx serves the SPA and proxies `/auth`, `/users`, `/tweets`, and `/health` to the api service over the compose network.

#### Scenario: API reachable only through the proxy
- GIVEN the running stack
- WHEN a client calls `http://localhost:${WEB_PORT}/health`
- THEN nginx MUST forward to the api service and return its response; the api service publishes no mandatory host port of its own

#### Scenario: Session cookie is first-party end to end
- GIVEN a user registering and logging in through the proxy
- WHEN the login response sets the httpOnly cookie
- THEN a subsequent `GET /auth/me` through the proxy with that cookie MUST return the session user (no CORS preflight involved)

#### Scenario: Client-side routes fall back to the SPA
- GIVEN the running stack
- WHEN a browser requests a client route such as `/u/somebody` directly
- THEN nginx MUST serve `index.html` (SPA fallback), not a 404

### Requirement: Runnable Production Build

The API production build MUST boot with plain Node — inside and outside Docker.

#### Scenario: Compiled API boots outside Docker
- GIVEN `pnpm --filter @twitterclone/api build` has run and a reachable database plus `JWT_SECRET` are configured
- WHEN `node dist/main.js` runs from `apps/api`
- THEN the API MUST start and answer `/health`, including resolving `@twitterclone/shared` runtime values

#### Scenario: Dev workflow unchanged
- GIVEN the repo as checked out
- WHEN a developer runs `docker compose up -d postgres` + `pnpm --filter api start:dev` + `pnpm --filter web dev`
- THEN both apps MUST behave exactly as before this change (source-consumed shared, hot reload, CORS for localhost:5173)

### Requirement: Demo Data in the Container

The seed MUST be runnable against the dockerized stack.

#### Scenario: Seeding the running stack
- GIVEN the running stack
- WHEN `docker compose exec api npx ts-node prisma/seed.ts` runs
- THEN the deterministic demo dataset MUST be inserted and `ada@theflock.dev` / `Flock123!` MUST log in through the proxy
