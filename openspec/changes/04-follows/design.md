# Design: 04-follows — Follow/Unfollow + User Search

## Technical Approach

New `FollowsModule` mirrors the tweets/auth domain pattern: controller + service + `PrismaService` via DI, global guard (no `@Public()`). Username is the public identifier on every route (`/users/:username/follow`) — the service resolves it to an id first and 404s early. Search stays in `UsersModule` (it owns the `User` model) and requires the module's first controller. `isFollowing` is always computed server-side with one batched query — the client never derives social-graph state. Frontend adds a protected `/explore` route (`features/users`) with debounced search and optimistic follow toggles; Home only gains a nav link, its internals and test contracts untouched. Timeline needs zero API changes: follows created here light it up, and the web invalidates the timeline cache after any follow mutation so the feed refreshes with the new author's tweets.

## Architecture Decisions

| Decision | Options | Choice + Rationale |
|----------|---------|--------------------|
| Duplicate follow semantics | 409 Conflict vs idempotent | **Idempotent** — `createMany({ skipDuplicates: true })` for follow, `deleteMany` for unfollow. Zero-race atomicity, and the optimistic UI never gets a spurious error for a de-facto correct state (rapid double-click scenario). |
| Idempotency implementation | pre-check `findUnique` vs `createMany skipDuplicates` / `deleteMany` | **createMany/deleteMany** — one query, atomic, no TOCTOU race between check and insert. Pre-check only for the username→user resolution (needed for 404/400 anyway). |
| Route shape | `/follows` body-based vs `/users/:username/follow` | **`/users/:username/follow`** — username is the public handle everywhere (profile URLs later in 05); avoids exposing internal ids in the API surface. |
| Lists pagination | cursor (like timeline) vs `?limit` cap | **`?limit` cap** (default 50, max 100, validated DTO). Cursor here is premature at challenge scale (~10 seeded users); trade-off documented in README later. Lists return `{ items: UserSummary[] }`. |
| Search matching | ILIKE `contains` on username OR displayName vs full-text | **Prisma `contains` + `mode: 'insensitive'`** on both fields, capped at 10, session user excluded. No index — documented trade-off at this scale. Empty `q` → 400 via DTO `@Length(1, 50)`. |
| `isFollowing` computation | per-row subquery vs one batched query vs client-side | **One batched query**: `follow.findMany({ where: { followerId: sub, followingId: { in: resultIds } } })` → `Set` lookup while mapping. O(1) extra round-trip, no N+1, single source of truth. |
| Search UX placement | HomePage section vs `/explore` route | **`/explore` protected route** — HomePage untouched (03 lesson: preserve `data-testid` contracts), mobile-first natural nav target, and 05's profile links slot into the same cards. |
| Follow mutation hook shape | separate `useFollow`/`useUnfollow` vs single toggle | **Single `useToggleFollow`** taking `{ username, isFollowing }` — one optimistic cache-update path, one rollback path, flips `isFollowing` in every cached search result. Mirrors the tweets optimistic pattern. |
| Timeline freshness after follow | do nothing vs invalidate | **Invalidate `TIMELINE_QUERY_KEY` on settled** — following someone visibly changes the home feed on next visit without a manual reload. |

## Data Flow

    POST /users/:username/follow ─▶ FollowsController(req.user.sub)
        └▶ FollowsService.follow: resolve username (404) → self-check (400)
           └▶ prisma.follow.createMany({ data:[{followerId:sub, followingId:target.id}], skipDuplicates:true }) → { success: true }

    GET /users?q=ali ─▶ UsersController ─▶ UsersService.search(sub, q)
        └▶ user.findMany({ OR:[username contains, displayName contains], NOT:{ id:sub }, take:10 })
        └▶ follow.findMany({ followerId:sub, followingId:{ in: ids } }) → Set
        └▶ items: UserSummary[] (isFollowing from Set)

    web: /explore ─ SearchBox(debounce 300ms) ─▶ useSearchUsers(q) ─ UserCard ─ useToggleFollow
        └▶ onMutate: flip isFollowing in ['users','search',q] cache (rollback on error)
        └▶ onSettled: invalidate search + TIMELINE_QUERY_KEY

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/follows/follows.module.ts` | Create | wires controller + service |
| `apps/api/src/follows/follows.controller.ts` | Create | POST/DELETE `/users/:username/follow`, GET `/users/:username/{followers,following}` |
| `apps/api/src/follows/follows.service.ts` | Create | follow/unfollow (idempotent), followers/following lists, `toUserSummary` mapper |
| `apps/api/src/follows/dto/list-query.dto.ts` | Create | `limit` `@Type(Number) @IsInt @Min(1) @Max(100)` default 50 |
| `apps/api/src/users/users.controller.ts` | Create | GET `/users?q=` (module's first controller) |
| `apps/api/src/users/users.service.ts` | Modified | `search(sub, q)` with batched isFollowing |
| `apps/api/src/users/dto/search-users.dto.ts` | Create | `q` `@IsString @Length(1,50)` |
| `apps/api/src/users/users.module.ts` | Modified | register controller |
| `apps/api/src/app.module.ts` | Modified | register `FollowsModule` |
| `apps/api/test/follows.e2e-spec.ts` | Create | follow → timeline includes followed tweets (real flow, no seeding); idempotency; 400/404/401 |
| `packages/shared/src/index.ts` | Modified | `UserSummary`, `UserListResponse { items }` |
| `apps/web/src/features/users/{api,useSearchUsers,useToggleFollow}.ts` | Create | fetch + query + optimistic mutation |
| `apps/web/src/features/users/{SearchBox,UserCard,ExplorePage}.tsx` | Create | debounced input, card with follow button, route page |
| `apps/web/src/App.tsx` | Modified | `/explore` under `ProtectedRoute` |
| `apps/web/src/features/auth/HomePage.tsx` | Modified | header nav `Link` to `/explore` ONLY (no structural change) |
| `apps/web/src/test/msw/handlers.ts` | Modified | users search + follow/unfollow defaults |

## Interfaces / Contracts

```ts
interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isFollowing: boolean;
}
interface UserListResponse { items: UserSummary[]; }
// POST/DELETE follow → { success: true }
```

Errors: **400** self-follow / invalid `q` / invalid `limit` · **401** no session (global guard) · **404** unknown `:username`. Nest default body `{statusCode,message,error}`.

## Testing Strategy (TDD order = commit order)

| # | Layer | What | How |
|---|-------|------|-----|
| 1 | Unit | FollowsService: follow creates edge, idempotent re-follow, self 400, unknown 404; unfollow removes + idempotent | Jest, real `twitter_test` DB |
| 2 | Unit | Lists: followers/following sets, limit cap, isFollowing flags, unknown 404 | Jest |
| 3 | Unit+Int | UsersService.search: matches username+displayName case-insensitive, excludes self, cap 10, isFollowing batch; controller DTO 400s + 401 | Jest + Supertest (ValidationPipe) |
| 4 | E2E | register A+B → A follows B via API → A's timeline shows B's tweets; unfollow → gone; idempotent double-follow | Supertest agents (real flow — replaces 03's seeded-Follow hack) |
| 5 | Web | Mandatory follow flow: search → results → follow → optimistic flip + rollback on error; debounce; empty/loading/error states; /explore route protected | Vitest + TL + MSW (stateful handlers) |

Coverage ≥85% (dto/module excluded). Reuse `avatarUrlFor` (users/avatar.ts) in `toUserSummary`.

## Migration / Rollout

No migration — `Follow` table, composite PK and `followingId` index exist since change 01. Purely additive; revert feature commits to roll back. 03's e2e keeps its direct-seed approach (valid — it predates the API).

## Open Questions

- None. The four behavioral decisions (idempotency, capped lists, /explore, server-side isFollowing) were made pre-specs and are binding.
