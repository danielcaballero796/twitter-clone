# Design: 05-profile — User Profile Page

## Binding decisions

### D1 — Profile contract: `GET /users/:username` → `UserProfile`
```ts
/** packages/shared — profile payload for GET /users/:username */
export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  isFollowing: boolean; // session-relative, same semantics as change 04; false for own profile
}
```
- Single Prisma query in `UsersService.profile(sub, username)`: `findUnique({ where: { username }, include: { _count: { select: { followers: true, following: true, tweets: true } } } })` + one `follow.findUnique` on the composite PK `[sub, user.id]` for `isFollowing`. No N+1, no denormalized counters.
- `tweetsCount` counts ALL tweets including future replies — documented trade-off, fine at challenge scale; revisit only if change 07 (threads) ships a distinction.
- 404 unknown username (same error shape as follows service), 401 unauthenticated (global guard — no `@Public()`).
- **No `isSelf` field in the API.** The web client already caches the session user (`useSession` → `/auth/me`); own-profile detection is `session.username === profile.username`. Keeps the payload canonical and cacheable per-user.

### D2 — Tweets by user: `GET /users/:username/tweets` → `CursorPage<PublicTweet>`
- Semantics identical to `GET /tweets/timeline`: same default/max limit, same cursor encoding, newest-first, same `PublicTweet` mapping. The `[authorId, createdAt Desc]` index already serves this exactly.
- **Ownership**: the query logic belongs to `TweetsService` (owns the Tweet model) as `listByUsername(username, { limit, cursor })` — resolve username → 404 first, then reuse the existing pagination helper (extract a private shared helper from `timeline()` if needed; do NOT duplicate cursor logic).
- **Routing**: handler lives in `UsersController` (`@Get(':username/tweets')`) to keep the `/users/:username/*` URL space in one controller. `TweetsModule` exports `TweetsService`; `UsersModule` imports `TweetsModule`. Reuse the existing timeline query DTO for `limit`/`cursor` validation.
- **Route ordering inside `UsersController`** (NestJS matches in declaration order): `@Get()` (search) → `@Get(':username/tweets')` → `@Get(':username')`. The two-segment path cannot collide with follows routes (`:username/followers|following|follow`) — distinct literals; e2e must still prove all five `/users/:username*` routes coexist.

### D3 — Web data layer: two queries + one extended mutation
- `PROFILE_QUERY_PREFIX = ['users', 'profile']`, `profileQueryKey(username) = [...PROFILE_QUERY_PREFIX, username]` → `useProfile(username)`.
- `userTweetsQueryKey(username)` under a `USER_TWEETS_QUERY_PREFIX` → `useUserTweets(username)` (single page like `useTimeline`'s current shape; adopt whatever pagination consumption pattern `useTimeline` uses — mirror, don't innovate).
- **`useToggleFollow` is extended, not duplicated** (single source of truth for follow transitions). `onMutate` additionally: cancel + snapshot `profileQueryKey(username)`, flip `isFollowing` AND adjust `followersCount` ±1 optimistically. `onError` restores both snapshots. `onSettled` additionally invalidates `PROFILE_QUERY_PREFIX`. Existing search-flip behavior and timeline invalidation unchanged — existing 04 tests must stay green untouched.

### D4 — Web UI: `/u/:username`
- Route `/u/:username` under the existing `ProtectedRoute` (mirrors `/explore`); unauthenticated → login redirect (test it).
- `ProfilePage`: header (avatar, displayName, @username, bio when present, followersCount/followingCount/tweetsCount) + follow/unfollow button (reuses `useToggleFollow`) + the user's tweets rendered with the existing `TweetCard`. Loading / error / not-found (404 → "user not found" state) handled like ExplorePage's states.
- **Own profile**: no follow button (compare against `useSession` user per D1). Delete button on own tweets keeps working via existing `TweetCard` behavior — do not fork TweetCard for the profile.
- **Navigation**: `UserCard` display-name block links to `/u/:username`; `TweetCard` author (name/handle) links to `/u/:username`. Both are `Link` wraps with NO structural change — every existing `data-testid` and test must keep passing.

### D5 — MSW: stateful defaults (closes 04 verify warning #3)
- Refactor `apps/web/src/test/msw/handlers.ts` so the DEFAULT handlers read/mutate one in-memory fixture store (users + follow edges + tweets), reset between tests via the existing setup reset hook. Profile and user-tweets handlers derive counts from that store, so follow → profile refetch reflects the new count without per-test overrides.
- Migrate the follow-flow test's local stateful override from `ExplorePage.test.tsx` into these defaults; per-test `server.use(...)` remains only for error cases.

## Not doing
- No new Nest module, no migration, no new packages.
- No followers/following list pages, no edit profile (out of scope per proposal).

## Test strategy
Strict TDD per block. Backend: service unit tests (counts, isFollowing, 404), controller route-order proof via e2e (`profile.e2e-spec.ts`: register A+B → B tweets → A follows B → A GETs B's profile: counts + isFollowing true → A GETs B's tweets: contents + pagination → 404 unknown → 401 unauthenticated → search still works with `?q=`). Web: ProfilePage states (loading/error/not-found/own-vs-other), optimistic follow with followersCount bump + rollback, navigation from ExplorePage UserCard and timeline TweetCard, protected-route redirect. Coverage gate ≥85% api.
