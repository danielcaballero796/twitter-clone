# Tasks: 10-docker-fullstack

Blocks (5 commits). Dockerfiles/compose are verified by actually building and booting the stack (spec scenarios), not unit tests; repo-code changes keep the full test gate.

## Block 0 — Fix the production build

Commit: `fix(api): make the compiled build bootable with plain node`

- [x] 0.1 `apps/api/package.json`: `start` → `node dist/main.js`
- [x] 0.2 `packages/shared/package.json`: drop `exports`, `main: "src/index"` (extensionless), keep `types`
- [x] 0.3 Gate: `pnpm lint && pnpm typecheck && pnpm test` all green (proves every dev resolver still finds the .ts source)
- [x] 0.4 Smoke: build api, emit shared CJS next to source, `node dist/main.js` answers `/health`, then clean the emitted files

## Block 1 — API image

Commit: `feat(docker): containerize the api with migrate-on-boot`

- [x] 1.1 `.dockerignore` (node_modules, dist, .env*, coverage, .git)
- [x] 1.2 `apps/api/Dockerfile` multi-stage per D4
- [x] 1.3 Verify: `docker build -f apps/api/Dockerfile .` succeeds

## Block 2 — Web image

Commit: `feat(docker): containerize the web app behind an nginx proxy`

- [x] 2.1 `docker/nginx.conf` per D5 (SPA fallback + API prefix proxy)
- [x] 2.2 `apps/web/Dockerfile` per D3/D5
- [x] 2.3 Verify: `docker build -f apps/web/Dockerfile .` succeeds

## Block 3 — Compose + runbook

Commit: `feat(docker): run the full stack with docker compose`

- [x] 3.1 `docker-compose.yml`: api + web services, healthchecks, `WEB_PORT`, `.env` optional (D6)
- [x] 3.2 `.env.example`: document `WEB_PORT` + docker defaults
- [x] 3.3 Full verification (spec scenarios): cold boot, health via proxy, register/login/me with cookie jar, SPA fallback, seed via exec, `WEB_PORT` override without rebuild
- [x] 3.4 README: Docker-first runbook + dev-mode section + trade-offs update

## Block 4 — CI + archive

Commits: `ci: prove docker compose runbook with a smoke job`, `chore(openspec): archive 10-docker-fullstack`

- [x] 4.1 `docker-smoke` job in ci.yml per D8
- [x] 4.2 Sync spec to `openspec/specs/infra-docker/`, archive change, update state.yaml
