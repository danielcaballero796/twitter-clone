# Proposal: 06-likes — Like/Unlike Tweets with Counters

## Intent

Ship likes: the last leg of the challenge's core functional triad (tweets → follows → likes). Users like/unlike any tweet and every tweet payload carries a like counter plus a session-relative `likedByMe` flag, surfaced in the web UI as an optimistic like button on `TweetCard` — everywhere TweetCard renders (timeline and profile).

## Rubric mapping

Funcionalidad (25): like/unlike end-to-end with counters in timeline and profile. Testing (25): unit + e2e + FE optimistic-toggle tests. Calidad (20): mirrors the proven follows patterns (idempotency, session-relative flags, single toggle hook). Proceso (15): TDD, granular conventional commits.

## Scope

### In Scope
- **Backend** `apps/api/src/likes`: `POST /tweets/:tweetId/like` and `DELETE /tweets/:tweetId/like` — idempotent both ways (follows semantics: re-like and unlike-when-not-liked are 200 no-ops), 404 unknown tweet, 401 unauthenticated. New `LikesModule` mirroring `FollowsModule` (edge mutations only).
- **Backend** tweet payload enrichment: `PublicTweet` gains `likesCount: number` and `likedByMe: boolean` (session-relative). Computed in `TweetsService` for `create`, `timeline`, and `listByUsername` via `_count.likes` + one batched `like.findMany` per page (no N+1).
- `packages/shared`: extend `PublicTweet` (required fields, not optional — all fixtures updated).
- **Frontend**: like button with count on `TweetCard` (both timeline and profile automatically); `useToggleLike` single mutation hook with optimistic flip + count ±1 across cached tweet pages, rollback on error, invalidate on settled; stateful MSW like handlers on the existing store.

### Out of Scope
- Likes list ("who liked this"), notifications.
- Replies/threads and SSE (day-3 bonuses, separate change).
- Seed script (next change, immediately after this one).

## Approach

Symmetry with change 04: `LikesModule` owns the edge mutations (like `FollowsModule` owns follow edges); `TweetsService` owns payload enrichment (like `UsersService` owns `isFollowing` embedding). Schema is final since change 01: `Like` composite PK `[userId, tweetId]` + index on `tweetId` — no migration. `createMany({skipDuplicates})`/`deleteMany` give idempotency for free. Since every tweet read flows through `toPublicTweet`/`paginateTweets`, enrichment lands in one choke point. Web mirrors `useToggleFollow`'s optimistic pattern against the tweet-page caches. Strict TDD.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/likes/**` | New | module, controller, service + specs |
| `apps/api/src/tweets/tweets.service.ts` | Modified | `_count.likes` + batched `likedByMe`; `toPublicTweet` signature grows session context |
| `apps/api/src/app.module.ts` | Modified | register `LikesModule` |
| `apps/api/test/likes.e2e-spec.ts` | New | like → timeline reflects count/flag; unlike; idempotency; 404/401 |
| `packages/shared/src/index.ts` | Modified | `PublicTweet` + `likesCount`/`likedByMe` |
| `apps/web/src/features/tweets/**` | Modified | TweetCard like button, `useToggleLike`, tests |
| `apps/web/src/test/msw/handlers.ts` | Modified | like handlers on the stateful store; tweet fixtures gain like fields |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `PublicTweet` shape change breaks existing web tests/fixtures | High (by design) | Required fields force compile-time discovery; update MSW store fixtures in the same block as the type change |
| Optimistic like flip must hit multiple caches (timeline + user-tweets pages) | Med | One flip helper over both prefixes, mirroring `useToggleFollow`'s multi-cache pattern; invalidate both on settled |
| `toPublicTweet` session-context refactor ripples through tweets service tests | Med | RED first; keep mapper pure (likedByMe passed in, not queried per-tweet) |

## Rollback Plan

Additive module + one enrichment refactor confined to `TweetsService` + FE feature edits. Revert feature commits; no migration. Changes 01–05 intact.

## Dependencies

- `Like` model shipped in change 01's schema — no migration.
- Follows idempotency semantics (04) reused as the contract template.
- Seed change (next) will use the like API contracts defined here.

## Success Criteria

- [ ] `POST /tweets/:id/like` idempotent; `DELETE /tweets/:id/like` idempotent; 404 unknown tweet; 401 unauthenticated.
- [ ] Timeline and user-tweets payloads carry correct `likesCount` and session-relative `likedByMe` (A likes B's tweet → A sees `likedByMe: true`, C sees `false`, both see count 1) — proven e2e.
- [ ] Web: like button shows count, flips + increments optimistically, rolls back on failure — in timeline and profile.
- [ ] Backend coverage ≥ 85%; granular conventional commits; CI green.
