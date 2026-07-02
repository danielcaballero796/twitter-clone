# Proposal: 04-follows — Follow/Unfollow + User Search

## Intent

Ship the social graph: users find other users via search and follow/unfollow them, which makes the change-03 timeline show real followed content (it already queries `Follow` rows — zero timeline changes needed). Includes the challenge's mandatory frontend follow-flow test. Profile page is deliberately deferred to change 05 (time-permitting) to keep this change small and shippable.

## Rubric mapping

Funcionalidad (25): follow/unfollow + lists + user search end-to-end. Testing (25): unit + integration + mandatory FE follow-flow test. Calidad (20): domain module, validated DTOs, optimistic UI. Proceso (15): TDD, granular conventional commits with tests.

## Scope

### In Scope
- **Backend** `apps/api/src/follows`: `POST /users/:username/follow` (404 unknown user, 400 self-follow, idempotency decision in design), `DELETE /users/:username/follow`, `GET /users/:username/followers`, `GET /users/:username/following` (simple lists at challenge scale — pagination decision in design).
- **Backend** `apps/api/src/users`: `GET /users?q=` search by username/displayName (ILIKE, capped results, excludes no one; `isFollowing` flag decision in design).
- `packages/shared`: `UserSummary` (id, username, displayName, avatarUrl, isFollowing?) and response types.
- **Frontend** `apps/web/src/features/users`: search input (debounced) + `UserCard` with follow/unfollow button (optimistic toggle + rollback), reachable from Home (placement decision in design: inline section vs `/explore` route). Mandatory follow-flow test (search → follow → button flips → timeline gains followed user's tweets on refetch).

### Out of Scope
- Profile page, `GET /users/:username`, tweets-by-user (→ change 05 if time permits).
- Likes + counters (→ change 06), reply threads / SSE (bonus, day 3).
- Follower/following list UI pages (API ships now for 05 to consume; web lists only if trivially cheap).

## Approach

`FollowsModule` mirrors the auth/tweets domain pattern: controller per domain, service throwing Nest `HttpException`s, `PrismaService` via DI, global guard (no `@Public()`). Schema is final since change 01: `Follow` composite PK `[followerId, followingId]` + index on `followingId` — no migration. Search lives in the existing `UsersModule` (it owns the `User` model). Frontend follows the `features/tweets` patterns: TanStack Query mutation with optimistic cache update + rollback, MSW handlers for tests. Strict TDD (RED-GREEN-REFACTOR per block).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/follows/**` | New | module, controller, service + specs |
| `apps/api/src/users/**` | Modified | search endpoint + controller (users module has no controller yet) + specs |
| `apps/api/src/app.module.ts` | Modified | register `FollowsModule` |
| `apps/api/test/follows.e2e-spec.ts` | New | follow → timeline reflects it; unfollow; self/404/duplicate cases |
| `packages/shared/src/index.ts` | Modified | `UserSummary`, search/list response types |
| `apps/web/src/features/users/**` | New | api.ts, `useSearchUsers`, `useFollow`/`useUnfollow`, SearchBox, UserCard + tests |
| `apps/web/src/features/auth/HomePage.tsx` or router | Modified | entry point to search/follow UX (design decides placement) |
| `apps/web/src/test/msw/handlers.ts` | Modified | users search + follow handlers |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicate-follow semantics disagreement (409 vs idempotent 200) | Low | Decide in design, encode in spec scenarios before code |
| Optimistic follow toggle desyncs `isFollowing` across search results and future consumers | Med | Single query-cache shape for user summaries; invalidate on settle (same pattern as tweets) |
| Search UX placement bloats HomePage tests | Med | Design decides placement first; preserve existing `data-testid` contracts (lesson from 03) |
| ILIKE search without index is slow | Low | Challenge scale (seeded ~10 users); document trade-off, cap results (e.g. 10) |

## Rollback Plan

Fully additive: new module + one registered import, users controller addition, new FE feature + one entry-point edit. Revert feature commits; no migration → no schema rollback. Changes 01–03 intact.

## Dependencies

- Change 03 timeline already filters by `Follow` rows — this change feeds it, no API changes.
- No new packages backend or frontend.
- Seed (planned later change) will use the follow API contracts defined here.

## Success Criteria

- [ ] `POST /users/:username/follow` creates the edge (author = session user); self-follow 400; unknown user 404; duplicate handled per spec.
- [ ] `DELETE /users/:username/follow` removes the edge; unfollow-when-not-following handled per spec.
- [ ] `GET /users?q=` returns matching users with correct `isFollowing` per session user.
- [ ] After following user B, session user's `GET /tweets/timeline` includes B's tweets (e2e, no seeding hack — real API flow).
- [ ] Frontend: mandatory follow-flow test green (search → follow → optimistic flip → rollback on error).
- [ ] Backend coverage ≥ 85%; granular conventional commits with tests; CI green.
