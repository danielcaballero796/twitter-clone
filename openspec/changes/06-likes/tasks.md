# Tasks: 06-likes — Like/Unlike Tweets with Counters

## 0. Setup — commit: `feat(shared): add likesCount and likedByMe to PublicTweet`
- [x] 0.1 Extend `PublicTweet` in `packages/shared/src/index.ts` per D1: add REQUIRED `likesCount: number` and `likedByMe: boolean` fields
- [x] 0.2 Mechanically update every web MSW fixture/mock tweet object (`apps/web/src/test/msw/handlers.ts` fixture store and any inline test fixtures) to include `likesCount: 0, likedByMe: false` so the whole repo stays green at this commit — no behavior change, additive fields only
- [x] 0.3 Run `pnpm --filter shared typecheck`, `pnpm --filter api typecheck`, `pnpm -r typecheck`, and full `pnpm test` — all green (this block keeps the entire repo compiling and passing, not just api)

## 1. API likes module (D2) — commit: `feat(api): add like/unlike with idempotency + tests`
- [x] 1.1 RED: `apps/api/src/likes/likes.service.spec.ts` — `like(userId, tweetId)` creates the edge on first call; idempotent re-like (second call, no duplicate edge, no error); unknown tweet rejected with 404 on like; `unlike(userId, tweetId)` removes the edge; idempotent unlike when not liked (no error); unknown tweet rejected with 404 on unlike. Run → failing
- [x] 1.2 GREEN: `apps/api/src/likes/likes.module.ts`, `likes.service.ts`, `likes.controller.ts` — controller `@Controller('tweets/:tweetId')` with `@Post('like')` / `@Delete('like')` (both 200); service resolves tweet existence first (`findUnique` → 404 `'Tweet not found'`), then `like()` via `createMany({ data, skipDuplicates: true })`, `unlike()` via `deleteMany`; register `LikesModule` in `app.module.ts`
- [x] 1.3 REFACTOR: rerun green

## 2. API payload enrichment (D3) — commit: `feat(api): add like counts and likedByMe to tweet payloads + tests`
- [x] 2.1 RED: `apps/api/src/tweets/tweets.service.spec.ts` additions — timeline items carry `likesCount`/`likedByMe`; `listByUsername` items carry both; `likedByMe` is session-relative (same tweet, different session users get different values); `likesCount` aggregates correctly across 2 likers; `create()` returns `likesCount: 0, likedByMe: false`; `likesCount` returns to 0 after like-then-unlike on subsequent fetch. Run → failing
- [x] 2.2 GREEN: `paginateTweets` (shared helper) adds `_count: { select: { likes: true } }` to the query `include`, then ONE batched `like.findMany({ where: { userId: sessionUserId, tweetId: { in: pageIds } } })` → `Set` for `likedByMe`; `toPublicTweet(tweet, likedByMe: boolean)` stays a pure mapper, flag computed and passed in by the caller; `create()` maps to `likesCount: 0, likedByMe: false`; `listByUsername` gains a `sessionUserId` first param — order `(sessionUserId, username, opts)` — with `UsersController` passing `req.user.sub`
- [x] 2.3 REFACTOR: rerun green; confirm no N+1 (single batched `like.findMany` per page) and no duplicated cursor-pagination logic between `timeline()` and `listByUsername()`

## 3. E2E — commit: `test(api): add likes e2e flow with timeline integration`
- [x] 3.1 RED: `apps/api/test/likes.e2e-spec.ts` — register A+B → B creates tweets → A likes B's tweet → A's timeline shows `likesCount: 1` + `likedByMe: true` → B fetches own tweets via `GET /users/B/tweets`: `likesCount: 1`, `likedByMe: false` (B is author, didn't like it) → second liker (C) likes the same tweet → `likesCount: 2` → A double-likes → idempotent, `likesCount` unchanged → A unlikes → `likesCount` back down (0 remaining from A, still 1 from C) → A unlikes again → idempotent, no error → `POST`/`DELETE /tweets/:unknownId/like` → 404 → `POST`/`DELETE /tweets/:tweetId/like` unauthenticated → 401. Run → failing
- [x] 3.2 GREEN: fix any gaps surfaced by e2e (module wiring, route registration, param order) — expect no gaps if blocks 1–2 are solid
- [x] 3.3 REFACTOR: all e2e suites green (auth + tweets + follows + profile + likes + health)

## 4. Web MSW + data layer (D4+D5) — commit: `feat(web): add like toggle hook and stateful like handlers`
- [x] 4.1 Extend `apps/web/src/test/msw/handlers.ts` in-memory store: tweets gain `likesCount`/`likedByMe` state; add default `POST /tweets/:tweetId/like` and `DELETE /tweets/:tweetId/like` handlers that idempotently mutate the store (mirroring the API's create-many/delete-many idempotency), so refetch-after-mutation reflects reality without per-test overrides; error cases remain per-test `server.use(...)`
- [x] 4.2 `apps/web/src/features/tweets/useToggleLike.ts` — `useToggleLike({ tweetId, likedByMe })` mutation mirroring `useToggleFollow`: POST when not liked, DELETE when liked, against `/tweets/:tweetId/like`
- [x] 4.3 `onMutate`: cancel + snapshot BOTH the timeline cache (`TIMELINE_QUERY_KEY` prefix) and the user-tweets cache (`USER_TWEETS_QUERY_PREFIX`); apply one shared flip helper across both, mapping over cached pages and flipping `likedByMe` + adjusting `likesCount` by ±1 for the target tweet id only
- [x] 4.4 `onError`: restore both snapshots. `onSettled`: invalidate both prefixes
- [x] 4.5 Run existing hook/handler tests — all stay green unchanged

## 5. Web UI (D4) — commit: `feat(web): add like button with optimistic count + tests`
- [x] 5.1 RED: `apps/web/src/features/tweets/TweetCard.test.tsx` — like button renders with count including 0; clicking like on an unliked tweet flips to liked state and increments count by 1 optimistically; clicking unlike on a liked tweet flips to not-liked state and decrements count by 1 optimistically; mutation failure rolls back both button state and count and surfaces an error; existing delete behavior and all existing `data-testid`s unchanged. `apps/web/src/features/users/ProfilePage.test.tsx` (or a user-tweets-cache-focused test) — like toggle works on a `TweetCard` rendered from the user-tweets cache on the profile page, with the same rollback-on-failure behavior. Run → failing
- [x] 5.2 GREEN: add a like button (heart icon + count) to `apps/web/src/features/tweets/TweetCard.tsx` using `useToggleLike`, with `aria-pressed` reflecting `likedByMe`; additive only — no changes to existing structure or `data-testid`s
- [x] 5.3 REFACTOR: full web suite green, `pnpm -r typecheck` clean

## 6. Final verification
- [ ] 6.1 `pnpm test` (all workspaces) green; `pnpm build` green; api coverage ≥85% (dto/module excluded); `pnpm lint` clean; `pnpm format` (check-only at root; run `pnpm format:write` to fix, then reverify `pnpm format`) clean; `pnpm -r typecheck` clean
- [ ] 6.2 Push; confirm CI green

## Scenario Coverage Checklist (20/20)
- **Likes API — Like (4)** [G1]: Successful like; idempotent re-like; unknown tweet rejected (404); unauthenticated like rejected (401)
- **Likes API — Unlike (4)** [G1]: Successful unlike; idempotent unlike when not liked; unknown tweet rejected (404); unauthenticated unlike rejected (401)
- **Tweets-Likes Enrichment (6)** [G2]: Timeline tweets carry `likesCount`/`likedByMe`; user-tweets payload carries `likesCount`/`likedByMe`; `likedByMe` is session-relative; `likesCount` aggregates across multiple likers; new tweet starts at `likesCount: 0`/`likedByMe: false`; count returns to zero after like-then-unlike
- **Web Likes — Button + Toggle (3)** [G3]: Like button renders with count including zero; optimistic like flip + increment; optimistic unlike flip + decrement
- **Web Likes — Rollback + Profile + Compatibility (3)** [G3]: Rollback of button state and count with error surfaced on failure; like toggle works on profile (user-tweets cache) tweets; existing `TweetCard` delete behavior and data-testids unchanged

Counts: likes spec 8 (4+4) + tweets-likes spec 6 + web-likes spec 6 (3+3) = **20**, verified by direct count against the three spec files.
