# Tasks: 05-profile — User Profile Page

## 0. Setup
- [ ] 0.1 Add `UserProfile` to `packages/shared/src/index.ts` per D1: `{ id, username, displayName, bio: string | null, avatarUrl, followersCount, followingCount, tweetsCount, isFollowing }`

## 1. API profile endpoint (D1) — commit: `feat(api): add user profile endpoint with counts + tests`
- [ ] 1.1 RED: `apps/api/src/users/users.service.spec.ts` — `profile(sub, username)` returns all `UserProfile` fields; `followersCount`/`followingCount`/`tweetsCount` match `_count` exactly (no denormalized drift); `isFollowing` true when session user S follows target; `isFollowing` false when S does not follow target; `isFollowing` false on own profile (S requests own username); unknown username → 404 (same shape as follows service). Run → failing
- [ ] 1.2 GREEN: `apps/api/src/users/users.service.ts` — `profile(sub, username)`: single `findUnique({ where: { username }, include: { _count: { select: { followers: true, following: true, tweets: true } } } })` + one `follow.findUnique` on composite PK `[sub, user.id]` for `isFollowing` (short-circuit to `false` when `sub === user.id`, no self-follow lookup needed); 404 on miss. `apps/api/src/users/users.controller.ts` — declare routes in order `@Get()` (search) → `@Get(':username/tweets')` → `@Get(':username')` (profile) from the start, per D2 route-ordering rule
- [ ] 1.3 REFACTOR: rerun green

## 2. API user tweets (D2) — commit: `feat(api): add user tweets listing with cursor pagination + tests`
- [ ] 2.1 RED: `apps/api/src/tweets/tweets.service.spec.ts` — `listByUsername(username, { limit, cursor })` returns only that user's tweets, newest-first, excludes other users' tweets; `CursorPage` shape with working cursor pagination (first page `hasMore: true`, second page via `nextCursor` has no overlap with first); empty page for user with zero tweets (`items: []`, `nextCursor: null`, `hasMore: false`); unknown username → 404 resolved before any tweet query runs. `apps/api/src/users/users.controller.spec.ts` — limit bounds identical to `TimelineQueryDto` (default 20, `limit=50` accepted, `limit=51` rejected 400) on `GET :username/tweets`. Run → failing
- [ ] 2.2 GREEN: extract a private shared pagination helper out of `TweetsService.timeline()` (no duplicated cursor logic) and reuse it in new `listByUsername(username, opts)` (resolve username → 404 first via `UsersService`-free lookup on `prisma.user`, then apply the shared helper filtered by `authorId`); `apps/api/src/tweets/tweets.module.ts` exports `TweetsService`; `apps/api/src/users/users.module.ts` imports `TweetsModule`; add `@Get(':username/tweets')` on `UsersController` (already correctly ordered per 1.2) reusing the existing timeline query DTO for `limit`/`cursor` validation
- [ ] 2.3 REFACTOR: rerun green, confirm no duplicated cursor-pagination code remains between `timeline()` and `listByUsername()`

## 3. E2E — profile + user-tweets flow — commit: `test(api): add profile e2e flow with counts and route coexistence`
- [ ] 3.1 RED: `apps/api/test/profile.e2e-spec.ts` — register A+B → B creates tweets → A calls `POST /users/B/follow` → A calls `GET /users/B` (expects counts correct + `isFollowing: true`) → A calls `GET /users/B/tweets` (expects B's tweet contents, newest-first, pagination via `nextCursor`) → A calls `GET /users/A` (own profile, expects `isFollowing: false`) → `GET /users/:unknown` and `GET /users/:unknown/tweets` → 404 → all profile/tweets endpoints unauthenticated → 401 → route-coexistence: `GET /users?q=<substring>`, `GET /users/B/followers`, `GET /users/B/following`, `GET /users/B`, `GET /users/B/tweets` in sequence each resolve to the correct handler with correct response. Run → failing
- [ ] 3.2 GREEN: fix any gaps surfaced by e2e (module wiring, route order, DTO validation)
- [ ] 3.3 REFACTOR: all e2e suites green (auth + tweets + follows + profile + health)

## 4. Web MSW stateful refactor (D5) — commit: `refactor(web): make msw handlers stateful and add profile handlers`
- [ ] 4.1 Refactor `apps/web/src/test/msw/handlers.ts` default handlers to read/mutate one in-memory fixture store (users + follow edges + tweets), reset between tests via the existing setup reset hook
- [ ] 4.2 Migrate `ExplorePage.test.tsx`'s local stateful follow-flow override into the new defaults; per-test `server.use(...)` remains only for error-case overrides
- [ ] 4.3 Add default `GET /users/:username` and `GET /users/:username/tweets` handlers deriving `UserProfile` fields and tweet pages from the store (so a follow mutation is reflected on profile refetch without per-test overrides)
- [ ] 4.4 Run full web test suite — all existing 04-follows and prior tests stay green unchanged in behavior

## 5. Web data layer (D3) — commit: `feat(web): add profile hooks and extend follow toggle to profile cache`
- [ ] 5.1 `apps/web/src/features/users/api.ts` — add `getProfile(username)` and `getUserTweets(username, opts)` API calls
- [ ] 5.2 `apps/web/src/features/users/useProfile.ts` — `useProfile(username)` via `profileQueryKey(username) = [...PROFILE_QUERY_PREFIX, username]`, `PROFILE_QUERY_PREFIX = ['users', 'profile']`
- [ ] 5.3 `apps/web/src/features/users/useUserTweets.ts` — `useUserTweets(username)` under `USER_TWEETS_QUERY_PREFIX`, mirroring `useTimeline`'s single-page pagination consumption pattern exactly (no new pattern)
- [ ] 5.4 Extend `apps/web/src/features/users/useToggleFollow.ts` (do not duplicate): `onMutate` additionally cancels + snapshots `profileQueryKey(username)`, flips `isFollowing` AND adjusts `followersCount` ±1 optimistically when a profile cache entry exists; `onError` restores both snapshots; `onSettled` additionally invalidates `PROFILE_QUERY_PREFIX`. Existing search-flip behavior and timeline invalidation unchanged
- [ ] 5.5 Run existing 04-follows hook tests — all stay green unchanged

## 6. Web UI (D4) — commit: `feat(web): add profile page with navigation and tests`
- [ ] 6.1 RED: `apps/web/src/features/users/ProfilePage.test.tsx` — header renders identity + counts with bio present; header renders identity + counts without an empty/placeholder bio element when `bio: null`; user's tweets rendered via `TweetCard` in API order; loading indicator while profile/tweets in flight; error state on non-404 profile failure; not-found state distinct from error state on 404; follow button flips optimistically and `followersCount` increments; unfollow button flips optimistically and `followersCount` decrements; rollback of both button state and `followersCount` + error surfaced on mutation failure; own profile (session user via `useSession`) renders no follow/unfollow button; `/u/:username` redirects to login when unauthenticated. `apps/web/src/features/users/UserCard.test.tsx` — clicking the display-name block navigates to `/u/:username`. `apps/web/src/features/tweets/TweetCard.test.tsx` — clicking the author name/handle navigates to `/u/:username`, existing `data-testid`s and structure unchanged. Run → failing
- [ ] 6.2 GREEN: `apps/web/src/features/users/ProfilePage.tsx` (header + follow button reusing `useToggleFollow` + tweets list reusing `TweetCard`, own-profile check via `session.username === profile.username`, loading/error/not-found states matching `ExplorePage`'s pattern); `apps/web/src/App.tsx` adds `/u/:username` under `ProtectedRoute`; wrap `UserCard`'s display-name block and `TweetCard`'s author name/handle in `Link to="/u/:username"` with no structural change
- [ ] 6.3 REFACTOR: full web suite green, `pnpm -r typecheck` clean

## 7. Final verification
- [ ] 7.1 `pnpm test` (all workspaces) green; `pnpm build` green; api coverage ≥85% (dto/module excluded); `pnpm lint` clean; `pnpm format --check` clean (Prettier miss = red CI in this repo — mandatory); `pnpm -r typecheck` clean
- [ ] 7.2 Push; confirm CI green

## Scenario Coverage Checklist (27/27)
- **Users Profile API — Payload (6)** [G1]: All `UserProfile` fields returned; counts correct via `_count`; `isFollowing` true when following; `isFollowing` false when not following; `isFollowing` false on own profile; unknown username rejected (404)
- **Users Profile API — Auth + Routing (2)** [G1]: Unauthenticated profile access rejected (401); search/followers/following/profile routes all resolve correctly (coexistence)
- **Users Tweets API (6)** [G2]: Returns only target user's tweets newest-first; `CursorPage` shape with working cursor pagination; limit default/max/reject semantics identical to timeline; empty page for user with no tweets; unknown username rejected (404, before query); unauthenticated rejected (401)
- **Web Profile — Route (1)** [G3]: Profile route protected (redirect when unauthenticated)
- **Web Profile — Header (2)** [G3]: Header renders identity/counts with bio present; header renders identity/counts without bio when absent
- **Web Profile — Tweets feed (1)** [G3]: User's tweets rendered via `TweetCard` in API order
- **Web Profile — Loading/Error/Not-found (3)** [G3]: Loading state; error state on non-404 failure; not-found state on 404
- **Web Profile — Follow toggle (3)** [G3]: Follow flips optimistically + `followersCount` increments; unfollow flips optimistically + `followersCount` decrements; rollback + error surfaced on failure
- **Web Profile — Own profile (1)** [G3]: No follow button on own profile
- **Web Profile — Navigation (2)** [G3]: `UserCard` navigates to profile; `TweetCard` author navigates to profile with structure/data-testids unchanged

Counts: users-profile spec 8 (6+2) + users-tweets spec 6 + web-profile spec 13 (1+2+1+3+3+1+2) = **27**, verified by direct count against the three spec files.
