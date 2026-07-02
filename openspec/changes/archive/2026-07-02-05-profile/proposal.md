# Proposal: 05-profile — User Profile Page

## Intent

Ship the user profile: a public-within-the-app page showing who a user is (avatar, display name, bio), their social weight (followers/following/tweets counts), their tweets, and a follow/unfollow button. This closes the navigation loop the app currently lacks — search results and tweet authors become clickable destinations instead of dead ends, and the change-04 follow lists API finally has a consumer surface.

## Rubric mapping

Funcionalidad (25): profile view end-to-end with counts, user tweets and follow toggle. Testing (25): unit + integration + FE profile-flow tests. Calidad (20): reuses existing domain modules, shared cursor pagination, optimistic UI already proven in 04. Proceso (15): TDD, granular conventional commits.

## Scope

### In Scope
- **Backend** `apps/api/src/users`: `GET /users/:username` → profile payload (user fields + `followersCount`, `followingCount`, `tweetsCount`, session-relative `isFollowing`); 404 unknown user, 401 unauthenticated. Route ordering with existing `GET /users?q=` handled explicitly.
- **Backend** tweets-by-user: `GET /users/:username/tweets` → `CursorPage<PublicTweet>` with the same limit/cursor semantics as the timeline (service ownership decision in design: TweetsService method exposed via users route).
- `packages/shared`: `UserProfile` type (includes `bio: string | null`).
- **Frontend** `apps/web/src/features/users`: `/u/:username` route under `ProtectedRoute` — `ProfilePage` with header (avatar, displayName, @username, bio, counts, follow button) + the user's tweets feed reusing `TweetCard`. Follow button reuses `useToggleFollow`, extended so the optimistic flip and settle-invalidation also cover the profile query. No follow button on own profile (self-detection decision in design).
- **Frontend navigation**: `UserCard` (explore results) and `TweetCard` author link to `/u/:username`.

### Out of Scope
- Edit profile / avatar upload (schema and challenge don't ask for it).
- Followers/following list pages UI (API exists since 04; page only if trivially cheap later).
- Likes + counters (→ change 06), reply threads / SSE (bonus, day 3).
- Pinned tweets, banners, join date.

## Approach

Fully additive over existing modules — no new module, no migration. Profile endpoint lives in `UsersModule` (owns the `User` model); counts come from Prisma `_count` on the same query (no N+1). Tweets-by-user reuses the exact cursor pagination already shipped in `TweetsService.timeline` (shared `CursorPage`). Frontend mirrors `features/tweets`/`features/users` patterns: `useProfile` + `useUserTweets` queries, MSW handlers, strict TDD. `useToggleFollow` grows a profile-cache concern instead of a second mutation hook — single source of truth for follow state transitions.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/users/**` | Modified | profile endpoint + dto + service method + specs |
| `apps/api/src/tweets/**` | Modified | `listByUsername` (or equivalent) + specs; module export if users route consumes it |
| `apps/api/test/profile.e2e-spec.ts` | New | register → follow → profile counts reflect it; tweets list; 404/401 |
| `packages/shared/src/index.ts` | Modified | `UserProfile` |
| `apps/web/src/features/users/**` | Modified/New | `useProfile`, `useUserTweets`, `ProfilePage` + tests; `useToggleFollow` extension; `UserCard` link |
| `apps/web/src/features/tweets/TweetCard.tsx` | Modified | author links to profile (preserve existing `data-testid`s) |
| `apps/web/src/App.tsx` | Modified | `/u/:username` route under `ProtectedRoute` |
| `apps/web/src/test/msw/handlers.ts` | Modified | profile + user-tweets handlers (stateful counts) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Route collision `GET /users/:username` vs `GET /users?q=` and follows routes | Low | `@Get()` (exact) registers before `@Get(':username')` in the same controller; follows routes are deeper segments — verify with e2e |
| `useToggleFollow` cache-flip grows octopus arms (search + profile + timeline) | Med | Design fixes the exact query-key surface it touches; one flip helper per cache shape, tested |
| TweetCard author link breaks existing timeline tests | Med | Preserve `data-testid`s; wrap author in `Link` without structural change (lesson from 03/04) |
| Counts drift vs lists at challenge scale | Low | Counts computed per-request via `_count` — no denormalization to drift |

## Rollback Plan

Fully additive: new endpoints on existing controllers/services, new FE routes/components, one `TweetCard` edit. Revert feature commits; no migration. Changes 01–04 intact.

## Dependencies

- Change 04 follow graph + `isFollowing` mapper (reused for profile).
- Change 03 tweets cursor pagination (reused for user tweets).
- No new packages.

## Success Criteria

- [ ] `GET /users/:username` returns profile with correct counts and session-relative `isFollowing`; 404 unknown; 401 unauthenticated.
- [ ] `GET /users/:username/tweets` returns that user's tweets newest-first with working cursor pagination; 404/401.
- [ ] e2e: A follows B → B's profile shows `followersCount` incremented; B tweets → B's profile tweets list and `tweetsCount` reflect it.
- [ ] Frontend: `/u/:username` shows header + tweets; follow button flips optimistically with rollback; own profile shows no follow button; explore results and tweet authors navigate to profiles.
- [ ] Backend coverage ≥ 85%; granular conventional commits; CI green.
