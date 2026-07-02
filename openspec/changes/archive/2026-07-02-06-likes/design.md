# Design: 06-likes — Like/Unlike Tweets with Counters

## Binding decisions

### D1 — Contract: extend `PublicTweet` (required fields)
```ts
export interface PublicTweet {
  id: string;
  content: string;
  createdAt: string;
  author: TweetAuthor;
  likesCount: number;   // total likes on the tweet
  likedByMe: boolean;   // session-relative, same semantics family as isFollowing
}
```
Required, NOT optional — the compiler flags every fixture/consumer that needs updating. All MSW store tweets and web test fixtures gain both fields in the same commit as the type change.

### D2 — Edge mutations: `LikesModule` mirroring `FollowsModule`
- `apps/api/src/likes/{likes.module,likes.service,likes.controller}.ts`; controller `@Controller('tweets/:tweetId')` with `@Post('like')` / `@Delete('like')` (both return 200).
- `like(userId, tweetId)`: resolve tweet exists first (`findUnique` → 404 `'Tweet not found'`), then `createMany({ data, skipDuplicates: true })` — idempotent re-like.
- `unlike(userId, tweetId)`: resolve tweet 404 first, then `deleteMany` — idempotent unlike-when-not-liked.
- No response body contract beyond 200 (same as follow/unfollow). Register `LikesModule` in `app.module.ts`.

### D3 — Payload enrichment: one choke point in `TweetsService`
- `paginateTweets` adds `_count: { select: { likes: true } }` to the query `include`, then ONE batched `like.findMany({ where: { userId: sessionUserId, tweetId: { in: pageIds } } })` → `Set` for `likedByMe`. No per-tweet queries (no N+1).
- `toPublicTweet(tweet, likedByMe: boolean)` — mapper stays pure; the flag is computed by the caller and passed in. `create()` returns `likesCount: 0, likedByMe: false` (a just-created tweet has neither).
- `timeline(userId, opts)` and `listByUsername(username, opts)` both need the session user for `likedByMe` → `listByUsername` gains a `sessionUserId` first param (controller already has `req.user.sub`). Keep param order consistent: `(sessionUserId, username, opts)`.

### D4 — Web: `useToggleLike` mirroring `useToggleFollow`
- `apps/web/src/features/tweets/useToggleLike.ts`: single mutation `useToggleLike({ tweetId, likedByMe })` → POST or DELETE `/tweets/:tweetId/like`.
- `onMutate`: cancel + snapshot BOTH tweet-page caches (`TIMELINE_QUERY_KEY` prefix and `USER_TWEETS_QUERY_PREFIX`); one flip helper maps over cached pages flipping `likedByMe` and adjusting `likesCount` ±1 for the target tweet id. `onError`: restore both snapshots. `onSettled`: invalidate both prefixes.
- `TweetCard` gains a like button (heart + count, `aria-pressed` for state) using the hook; count renders even at 0. Existing delete-button behavior and all existing `data-testid`s unchanged — additive only.
- No component fork: timeline and profile get the button through the shared `TweetCard`.

### D5 — MSW: extend the stateful store
- Store tweets gain `likesCount`/`likedByMe` state; add default `POST/DELETE /tweets/:tweetId/like` handlers mutating the store (idempotent, mirroring the API), so refetch-after-mutation reflects reality without per-test overrides. Error cases stay per-test `server.use`.

## Not doing
- No likes-list endpoint, no notification, no denormalized counter column (computed `_count` per request, challenge scale).
- No optional-field escape hatch on `PublicTweet`.

## Test strategy
Strict TDD. Backend: likes.service unit (idempotency both ways, 404s), tweets.service unit (counts, likedByMe batching, create → 0/false, both list endpoints enriched), e2e `likes.e2e-spec.ts` (A+B register → B tweets → A likes → A timeline shows count 1 + likedByMe true → B profile-tweets shows count 1 + likedByMe false for B... wait B is the author: B sees likedByMe false since B didn't like it → double-like idempotent → A unlikes → count 0 → unlike-again idempotent → 404 unknown tweet → 401s per endpoint). Web: TweetCard like button render + count, optimistic flip ±1 both directions, rollback + error surfaced, works on profile page too (one scenario via user-tweets cache). Coverage ≥85% api.
