# Proposal: 02-auth — Authentication & Session Foundation

## Intent

Implement the mandatory self-owned auth system: register, login, logout, protected routes and current-user retrieval. It is the gate for every social feature (tweets, follows, likes) — nothing ships without a session. Built test-first (strict TDD) to lock in the 85% coverage gate and satisfy the challenge's explicit end-to-end auth-flow requirement.

## Rubric mapping

Funcionalidad (25): core auth feature. Testing (25): unit + integration + mandatory E2E flow + FE login integration test. Calidad (20): domain modules, validated DTOs, global guard. Proceso (15): tests in same commit, granular conventional commits.

## Scope

### In Scope
- **Backend** `apps/api/src`: `users` + `auth` modules. Register (argon2id hash, unique email/username), Login (JWT in httpOnly cookie, SameSite=Lax, 7d), Logout (clear cookie), global `JwtAuthGuard` + `@Public()` decorator, `GET /auth/me`.
- class-validator DTOs: email format, password min length, username format + uniqueness.
- `main.ts` wiring: `cookie-parser`, global `ValidationPipe`.
- Avatar placeholder URL derived from username (DiceBear/UI Avatars) exposed via `/me`; username/bio fields available.
- **E2E**: register → login → access protected route → logout → rejected.
- **Frontend** `apps/web/src`: register + login pages (mobile-first), session hook (`/me` via TanStack Query), protected-route redirect, logout. Login-flow integration test (Vitest + Testing Library, MSW if needed).

### Out of Scope
- Tweets, follows, likes, search (changes 03-04).
- Profile page with followers/following lists (change 05).
- Refresh-token rotation, email verification, password reset, OAuth (documented trade-off).

## Approach

Schema already has `User` (email/username unique, passwordHash, displayName, bio) — no migration needed. NestJS domain modules with DI. `AuthService` handles hashing (argon2) + JWT sign; `@nestjs/jwt` reads token from cookie via a passport-less custom guard registered as `APP_GUARD`. `@Public()` sets metadata to bypass. Cookie: httpOnly, SameSite=Lax, secure in prod, 7d maxAge. Frontend: `useSession` query on `/me`, `<ProtectedRoute>` redirects unauthenticated users to `/login`. RED-GREEN-REFACTOR per unit.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/auth/**` | New | module, service, controller, guard, `@Public()`, DTOs, JWT strategy |
| `apps/api/src/users/**` | New | users module + service (create/find, uniqueness) |
| `apps/api/src/main.ts` | Modified | cookie-parser + global ValidationPipe |
| `apps/api/src/app.module.ts` | Modified | register Auth/Users modules + global guard |
| `apps/api/test/auth.e2e-spec.ts` | New | full-flow E2E |
| `apps/web/src/features/auth/**` | New | pages, useSession hook, ProtectedRoute, api client |
| `packages/shared/src` | Modified | shared auth DTO/response types |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| JWT-in-cookie guard misconfig blocks all routes | Med | E2E covers protected + public paths; `@Public()` on health |
| Coverage dips below 85% | Med | TDD from first commit; measure per module |
| argon2 native build fails cross-platform | Low | Dockerized test DB; pin version; CI catches |
| CORS/cookie not sent from Vite dev | Med | credentials:'include' + CORS `origin` + `credentials:true` |

## Rollback Plan

Auth is additive (new modules + two edited files). Revert the feature commits; `main.ts`/`app.module.ts` return to health-only. No DB migration, so no schema rollback. Prior change (01) stays intact.

## Dependencies

- `argon2`, `@nestjs/jwt`, `cookie-parser` (+ `@types/cookie-parser`), `class-validator`, `class-transformer` (api).
- `react-router-dom` (web) if not present.

## Success Criteria

- [ ] Register/login/logout/me endpoints pass unit + integration tests.
- [ ] E2E auth flow (register → login → protected → logout → rejected) green.
- [ ] Global guard blocks unauthenticated access; `@Public()` bypasses.
- [ ] Frontend login-flow integration test passes; protected route redirects.
- [ ] Backend coverage ≥ 85%; conventional commits with tests in same commit.
