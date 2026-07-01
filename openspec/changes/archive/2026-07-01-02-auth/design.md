# Design: 02-auth — Authentication & Session Foundation

## Technical Approach

Two NestJS domain modules. `UsersModule` owns persistence (create, uniqueness lookups) and the public-user mapper; `AuthModule` owns credentials (hash/verify + JWT sign) and HTTP surface (`/auth/register|login|logout|me`). A global `JwtAuthGuard` (`APP_GUARD`) protects everything by default; `@Public()` metadata bypasses it. JWT travels in an httpOnly cookie read by the guard. Frontend adds react-router, a TanStack Query `useSession` hook on `/auth/me`, and a `<ProtectedRoute>`. Shared request/response contracts live in `packages/shared`. Grounds on existing `PrismaService`, `HealthController` (becomes `@Public()`), and the proven Jest/Supertest + Vitest infra. Satisfies specs `auth` and `web-auth`.

## Architecture Decisions

| Decision | Options | Choice + Rationale |
|----------|---------|--------------------|
| Module split | one auth module vs users+auth | **users+auth**: `UsersService` stays credential-agnostic so 03/04 (tweets/follows) reuse it without auth coupling. `AuthService` owns hashing+JWT. |
| argon2 lib | `argon2` (node-gyp) vs `@node-rs/argon2` | **@node-rs/argon2**: ships NAPI prebuilt binaries, no compile step → avoids pnpm 10 blocking dep build scripts (the Prisma pain). `argon2id` variant via `hash(pw)` defaults. Windows+Linux clean. |
| Client → API transport | CORS+credentials vs Vite `server.proxy` | **enableCors + `credentials:'include'`**: mirrors the Dockerized prod topology (no proxy there) → one code path, evaluators reproduce reliably. Gotcha handled below. |
| Avatar | new DB column vs derived | **Derived at read** in the user mapper — schema has no `avatarUrl`, proposal forbids migration. `https://api.dicebear.com/9.x/identicon/svg?seed={username}`. |
| Web forms | react-hook-form vs controlled `useState` | **Controlled useState**: keeps deps minimal; two small forms don't justify a lib. |
| Login test isolation | MSW vs fetch mock | **MSW**: intercepts real fetch, asserts cookie/credentials path and success+error branches per spec. |

## Data Flow

    register/login ─▶ AuthController ─▶ AuthService ─▶ UsersService ─▶ Prisma
                                          │ sign JWT
                                          ▼ Set-Cookie(access_token, httpOnly)
    protected req ─▶ JwtAuthGuard(reads cookie, verify) ─▶ req.user ─▶ handler
    web: useSession ─GET /auth/me(credentials:include)─▶ guard ─▶ user | 401

## Cookie & JWT contract

- Payload: `{ sub: user.id, username }`; secret `JWT_SECRET` (→ `.env.example`); `expiresIn: '7d'`.
- Cookie `access_token`: `httpOnly`, `sameSite:'lax'`, `secure: NODE_ENV==='production'`, `path:'/'`, `maxAge: 7*24*60*60*1000`. Logout = `res.clearCookie('access_token', <same attrs>)`.
- CORS: `enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true })`. **Gotcha**: wildcard origin + credentials is rejected by browsers → origin MUST be explicit. Web fetch always `credentials:'include'`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/users/users.{module,service}.ts` | Create | create + findByEmail/Username/Id, `toPublicUser` mapper (avatar) |
| `apps/api/src/auth/auth.{module,service,controller}.ts` | Create | hash/verify, JWT sign, register/login/logout/me |
| `apps/api/src/auth/jwt-auth.guard.ts` | Create | reads cookie, verifies, honors `@Public()` via Reflector |
| `apps/api/src/auth/public.decorator.ts` | Create | `@Public()` metadata |
| `apps/api/src/auth/dto/{register,login}.dto.ts` | Create | class-validator DTOs |
| `apps/api/src/auth/types.ts` | Create | `Request['user']` augmentation |
| `apps/api/src/main.ts` | Modify | `cookie-parser`, global `ValidationPipe({whitelist,transform})`, `enableCors` |
| `apps/api/src/app.module.ts` | Modify | import Users/Auth + `JwtModule`, `APP_GUARD` provider |
| `apps/api/src/health/health.controller.ts` | Modify | add `@Public()` |
| `apps/api/test/auth.e2e-spec.ts` | Create | full-flow E2E |
| `apps/web/src/features/auth/**` | Create | `api.ts`, `useSession`, pages, `ProtectedRoute`, logout |
| `apps/web/src/App.tsx` + `main.tsx` | Modify | router + QueryClientProvider |
| `packages/shared/src/index.ts` | Modify | `RegisterRequest`, `LoginRequest`, `PublicUser` |

## Interfaces / Contracts

```ts
interface PublicUser { id: string; email: string; username: string;
  displayName: string; bio: string | null; avatarUrl: string; }
interface RegisterRequest { email: string; username: string; password: string; displayName: string; }
interface LoginRequest { email: string; password: string; }
```

Errors: 400 validation (ValidationPipe) · 401 invalid creds / no-tampered-expired token (generic, no enumeration) · 409 duplicate email/username (Prisma `P2002` → `ConflictException`). Nest default body `{statusCode,message,error}`.

## Testing Strategy (TDD order = commit order)

| # | Layer | What | How |
|---|-------|------|-----|
| 1 | Unit | UsersService create/uniqueness/mapper | Jest, real `twitter_test` DB |
| 2 | Unit | AuthService hash/verify, JWT, wrong-pw→401, dup→409 | Jest |
| 3 | Integration | Guard: public bypass, missing/tampered/expired→401 | Supertest |
| 4 | E2E | register→login→me→logout→rejected | Supertest, cookie jar |
| 5 | Web | login success(nav)+failure(inline) | Vitest + TL + MSW |

Coverage ≥85% (services/guard/controller; `.dto.ts`/`.module.ts`/`main.ts` excluded).

## Commit Sequence (conventional, tests same commit)

1. `feat(api): add users module with argon2 hashing + tests`
2. `feat(api): add auth register/login with jwt cookie + tests`
3. `feat(api): add global jwt guard and @Public + integration tests`
4. `feat(api): add /auth/me, logout + auth e2e flow`
5. `feat(web): add session hook, auth pages, protected route + login integration test`

## Migration / Rollout

No DB migration — schema already final. Additive modules + edits to `main.ts`/`app.module.ts`/`health`. Revert commits to restore health-only.

## Open Questions

- None blocking. `WEB_ORIGIN` and `JWT_SECRET` to be added to `.env.example` during apply.
