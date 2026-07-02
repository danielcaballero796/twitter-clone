# Design: 10-docker-fullstack

Decisions D1–D8 are binding for tasks/apply. D1 (topology) was chosen by the user after an explicit trade-off discussion.

## D1 — Single origin behind nginx (one host port)

nginx serves the built SPA and reverse-proxies the API route prefixes (`/auth`, `/users`, `/tweets`, `/health`) to `api:3000` over the compose network. The browser sees exactly one origin: `http://localhost:${WEB_PORT:-8080}`. Consequences: CORS ceases to apply, the session cookie is first-party (`SameSite=Lax` in its designed case), the api and postgres services publish no mandatory host ports, and the web image never contains a host port (see D3). Rejected alternative: publishing web+api on two ports — two collision surfaces, cross-origin cookie fragility in front of a reviewer, and `VITE_API_URL` baked per-port (rebuild to change ports).

## D2 — Fix the production build for real, in the repo

Two latent bugs block any container: `start` points at `dist/apps/api/src/main.js` (tsc emits `dist/main.js`), and `@twitterclone/shared` declares `"main"/"exports"` as `./src/index.ts`, which plain Node cannot load (`AVATAR_STYLES` is a runtime value, so the import cannot be erased). Fix in the repo, not in the image:

- `apps/api/package.json`: `"start": "node dist/main.js"`.
- `packages/shared/package.json`: drop `exports`, set `"main": "src/index"` (extensionless), keep `"types": "src/index.ts"`. Every dev tool (tsc, ts-node, vitest, ts-jest, Vite) probes extensions and keeps resolving `src/index.ts` — source consumption in dev is unchanged, zero new build steps locally. Plain Node probes `src/index.js`, which only exists where the API image build emits it (D4). Verified by the full lint/typecheck/test/dev gate in the same commit.

## D3 — Relative API URLs in the web bundle

Web image builds with `VITE_API_URL=""` → `request()` issues same-origin paths (`/auth/me`). The host port lives exclusively in the compose port mapping; changing `WEB_PORT` never requires an image rebuild.

## D4 — API image: node:22-slim multi-stage, migrate on boot

Build stage: corepack pnpm, manifests + `apps/api/prisma` copied first (postinstall runs `prisma generate`, needs the schema; layer-cache friendly), `pnpm install --frozen-lockfile --filter "@twitterclone/api..."`, copy sources, `pnpm --filter @twitterclone/api build`, then compile shared to plain CJS next to its source (`src/index.js`) so D2's extensionless `main` resolves. Runtime stage: same base (engine compatibility), copies `node_modules` + `packages` + `apps/api/{dist,prisma,node_modules,package.json}`. Entry: `npx prisma migrate deploy && node dist/main.js` — the reviewer never runs migrations. devDependencies ride along deliberately: `prisma` CLI (migrate deploy) and `ts-node` (seed) come from them; image-size golf is out of scope. `openssl` installed in both stages for Prisma engines on slim.

## D5 — Web image: nginx:alpine, SPA fallback + prefix proxy

`docker/nginx.conf`: `try_files $uri /index.html` for client routing; one `location` regex for the four API prefixes proxying to `api:3000` with standard forwarded headers. No cookie rewriting needed — same host from the browser's perspective.

## D6 — Compose: healthcheck-ordered, .env optional

`api` waits on postgres `service_healthy`; `web` waits on api `service_healthy` (node `fetch` against `/health` — no curl in slim). Every variable has a working default (`JWT_SECRET` falls back to an explicitly-named demo secret; `DATABASE_URL` points at the `postgres` service) so a clean checkout boots with zero env setup. `NODE_ENV` stays unset in the api service on purpose: the seed's production guard keeps protecting real deployments while demo seeding stays possible. Postgres keeps `${POSTGRES_PORT:-5432}` published for the native dev workflow.

## D7 — Dev mode unchanged

`docker compose up -d postgres` + `pnpm --filter api start:dev` + `pnpm --filter web dev` keeps hot reload, CORS-for-localhost:5173, and source-consumed shared exactly as today. Docker is the review/runbook path, not the dev path.

## D8 — CI proves the runbook

New `docker-smoke` job: `docker compose up -d --build` (default env), wait for health, then through the proxy: `GET /health`, register, login, `GET /auth/me` with the cookie jar. This is the same command sequence as the README runbook — if the job is green, the runbook works.
