# Tasks: 02-auth — Authentication & Session Foundation

## 0. Setup & Dependencies
- [x] 0.1 Install (api): `@node-rs/argon2`, `@nestjs/jwt`, `cookie-parser`, `@types/cookie-parser`; (web): `react-router-dom`, `msw`
- [x] 0.2 Add `JWT_SECRET`, `WEB_ORIGIN` to `.env.example`
- [x] 0.3 Add shared types to `packages/shared/src/index.ts`: `PublicUser`, `RegisterRequest`, `LoginRequest`

## 1. Users module — commit: `feat(api): add users module with argon2 hashing + tests`
- [x] 1.1 RED: `users.service.spec.ts` — create(), findByEmail/Username/Id, `toPublicUser` mapper + avatar derivation (Avatar generated on registration). Run → expect all failing
- [x] 1.2 GREEN: `apps/api/src/users/users.{module,service}.ts` — argon2id hash, uniqueness checks (P2002), DiceBear avatar URL, `toPublicUser` (no passwordHash)
- [x] 1.3 REFACTOR: rerun suite → 0 failures

## 2. Auth register/login — commit: `feat(api): add auth register/login with jwt cookie + tests`
- [x] 2.1 RED: `auth.service.spec.ts` + `auth.controller.spec.ts` — Successful registration, Invalid email rejected, Password too short rejected, Duplicate email rejected, Duplicate username rejected, Successful login (cookie httpOnly/SameSite=Lax/secure-prod/7d), Wrong password rejected, Unknown email rejected. Run → expect all failing
- [x] 2.2 GREEN: `auth.{module,service,controller}.ts`, `dto/{register,login}.dto.ts`, `JwtModule`, `Set-Cookie` on login
- [x] 2.3 REFACTOR: verify 401s generic (no enumeration), rerun green

## 3. Global JWT guard — commit: `feat(api): add global jwt guard and @Public + integration tests`
- [x] 3.1 RED: Supertest spec — no-cookie, tampered, expired token → 401; `@Public()` bypasses. Run → expect failing
- [x] 3.2 GREEN: `jwt-auth.guard.ts`, `public.decorator.ts`, `APP_GUARD` in `app.module.ts`, `@Public()` on `health.controller.ts`, wire `cookie-parser`/`ValidationPipe`/`enableCors` in `main.ts`
- [x] 3.3 REFACTOR: rerun green

## 4. Me, logout, E2E — commit: `feat(api): add /auth/me, logout + auth e2e flow`
- [x] 4.1 RED: extend spec — Me valid session, Me no session, Logout clears cookie, Access rejected after logout. Write `test/auth.e2e-spec.ts` — register→login→protected→logout→rejected. Run → expect all failing
- [x] 4.2 GREEN: add `GET /auth/me`, `POST /auth/logout` (clearCookie same attrs)
- [x] 4.3 REFACTOR: `pnpm --filter api test:e2e` + `--coverage` → green, ≥85% (98.19% statements)

## 5. Web auth — commit: `feat(web): add session hook, auth pages, protected route + login integration test`
- [ ] 5.1 RED: `LoginPage.test.tsx` (Vitest+TL+MSW) — success navigates, wrong creds inline error. Run → expect failing
- [ ] 5.2 GREEN: `features/auth/{api.ts,useSession.ts,RegisterPage.tsx,LoginPage.tsx,ProtectedRoute.tsx}` + logout — register (nav/inline 409), login (nav/generic error), `useSession` on `/auth/me`, `<ProtectedRoute>` redirect `/login`, logout clears cache+redirects
- [ ] 5.3 Wire `App.tsx`/`main.tsx`: router, `QueryClientProvider`, route tree
- [ ] 5.4 REFACTOR: `pnpm --filter web test` → green

## 6. Final verification
- [ ] 6.1 `pnpm test` + `pnpm build` (all workspaces) — green, api coverage ≥85%
- [ ] 6.2 Push; confirm CI green (`gh pr checks`)

## Scenario Coverage Checklist (28/28)
- **G1** (1): Avatar generated on registration
- **G2** (8): Successful registration; Invalid email rejected; Password too short rejected; Duplicate email rejected; Duplicate username rejected; Successful login; Wrong password rejected; Unknown email rejected
- **G3** (4): No-cookie→401; tampered→401; expired→401; Public bypasses
- **G4** (5): Me valid; Me no session; Logout clears cookie; Rejected post-logout; Full E2E flow
- **G5** (10): Register nav success; Register dup inline error; Login nav success; Login wrong-creds error; Session hook auth; Session hook unauth; Protected redirect; Protected allowed; Logout clears client session; Login integration test
