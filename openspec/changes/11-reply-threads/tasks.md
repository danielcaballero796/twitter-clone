# Tasks: 11-reply-threads

Blocks (6 commits). Strict TDD: within each testable block, failing tests land before the implementation that makes them pass. API suite runs `--runInBand` (already the package script) because tests share `twitter_test`.

## Block 0 — Shared contract

Commit: `feat(shared): add replyCount, inReplyTo, and parentId to the tweet contract`

- [x] 0.1 `packages/shared/src/index.ts`: `PublicTweet` gains `replyCount: number` and `inReplyTo: { id: string; username: string } | null`; `CreateTweetRequest` gains optional `parentId?: string`
- [x] 0.2 Gate: `pnpm typecheck` — confirms the additive fields don't break any existing consumer (api or web) that constructs/reads `PublicTweet`/`CreateTweetRequest`

## Block 1 — API

Commit: `feat(api): reply creation, reply count, thread retrieval, and reply listing`

- [x] 1.1 **Behavior-preserving pagination refactor first, gated alone.** In `tweets.service.spec.ts`, confirm/extend the existing descending-order tests for `timeline`/`listByUsername` (cursor pagination, invalid-cursor 400, `hasMore`/`nextCursor`, `likedByMe`) so they pin current behavior
- [x] 1.2 Generalize the private `paginateTweets` per D3: add `order: 'asc' | 'desc' = 'desc'` param, `orderBy: [{ createdAt: order }, { id: order }]`; keep the invalid-cursor guard, `take: limit + 1` slicing, batched `like.findMany` lookup, `nextCursor` derivation verbatim
- [x] 1.3 Gate: re-run 1.1's tests green with zero behavior change (timeline/profile callers keep implicit `desc`) — proves the refactor is safe before replies exist
- [x] 1.4 Add `TWEET_INCLUDE` shared constant (D2): `author: AUTHOR_SELECT`, `_count: { select: { likes: true, replies: true } }`, `parent: { select: { id: true, author: { select: { username: true } } } }`; wire it into every existing read site (`create`, `paginateTweets`, and new `getById`/`listReplies`) so `replyCount`/`inReplyTo` are never call-site-inlined
- [x] 1.5 `toPublicTweet` maps `replyCount: tweet._count.replies` and `inReplyTo` from `tweet.parent` (null-safe)
- [x] 1.6 Write failing specs in `tweets.service.spec.ts` for: reply creation persists `parentId` (201 shape, `inReplyTo` populated); unknown `parentId` throws `NotFoundException`; omitted `parentId` behaves byte-for-byte as before; `replyCount` reflects direct-reply count on a tweet; new tweet has `replyCount: 0`; reply-to-a-reply is allowed
- [x] 1.7 `CreateTweetDto`: add optional `parentId` (`@IsOptional() @IsString()`)
- [x] 1.8 `TweetsService.create(authorId, content, parentId?)`: when `parentId` present, `findUnique({ where: { id: parentId }, select: { id: true } })`, throw `NotFoundException('Parent tweet not found')` if absent, else persist `{ authorId, content, parentId }` with `TWEET_INCLUDE`
- [x] 1.9 Gate: 1.6's service specs green
- [x] 1.10 Write failing specs for `getById` (200 with `likedByMe`, 404 on missing) and `listReplies` (ascending order, empty page, cursor pagination, invalid cursor 400, 404 when parent tweet doesn't exist)
- [x] 1.11 `TweetsService.getById(sessionUserId, id)`: `findUnique` with `TWEET_INCLUDE`, `NotFoundException('Tweet not found')` if absent, `likedByMe` via existing single-tweet like lookup pattern
- [x] 1.12 `TweetsService.listReplies(sessionUserId, id, opts)`: validate parent exists (404, same message convention), then `paginateTweets(sessionUserId, { parentId: id }, { ...opts, order: 'asc' })`
- [x] 1.13 Gate: 1.10's service specs green
- [x] 1.14 Write failing controller specs (`tweets.controller.spec.ts`) asserting declaration order: `@Get('timeline')` is declared before `@Get(':id')`/`@Get(':id/replies')` so `GET /tweets/timeline` never routes to `getById` (D4 route-ordering pitfall)
- [x] 1.15 `TweetsController`: pass `dto.parentId` through `create`; add `@Get(':id')` → `getById`, `@Get(':id/replies')` → `listReplies` (reusing `TimelineQueryDto`), both declared **after** `@Get('timeline')`
- [x] 1.16 `CreateTweetDto`: add malformed-`parentId` validation shape scenario (empty string) — 400 before DB lookup; add matching failing-then-passing DTO/controller spec
- [x] 1.17 Write failing e2e specs in `tweets.e2e-spec.ts` per the API spec's 16 scenarios not yet covered at unit level: successful reply creation via `POST /tweets`, unknown-parentId 404, timeline includes replies unfiltered with `inReplyTo`, cascade delete removes the reply subtree (by id and from listings)
- [x] 1.18 Implement any remaining gap surfaced by 1.17 (expect none beyond wiring — cascade is schema-level, timeline filter is untouched by design)
- [x] 1.19 Demo-value: `apps/api/prisma/seed.ts` — add one demo reply thread (root tweet + 2-3 replies from different seeded users) so the thread UI has something to show out of the box
- [x] 1.20 Gate: `pnpm --filter api test` (unit + e2e, `--runInBand`) all green; full tweets suite (existing descending tests + new ascending/reply tests) passes

## Block 2 — Web data layer

Commit: `feat(web): add tweet/thread query keys, api client fns, and reply hooks`

- [ ] 2.1 `lib/queryKeys.ts`: add `TWEET_QUERY_PREFIX`/`tweetQueryKey(id)` and `REPLIES_QUERY_PREFIX`/`repliesQueryKey(id)` per D5
- [ ] 2.2 `features/tweets/api.ts`: add `fetchTweet(id)` (`GET /tweets/:id`) and `fetchReplies(id, cursor?)` (`GET /tweets/:id/replies`, mirrors `fetchTimeline`'s query-string building); extend `createTweet` to accept optional `parentId`
- [ ] 2.3 MSW handlers: add handlers for `GET /tweets/:id` (200 + 404 cases) and `GET /tweets/:id/replies` (paginated, empty, cursor) mirroring the real contract — new endpoints need new handlers, existing timeline/tweet handlers must return `replyCount`/`inReplyTo` fields so existing tests don't silently pass on stale fixtures
- [ ] 2.4 Write failing tests for `useTweet(id)` (loading/success/404 error) and `useReplies(id)` (ascending pages, `hasMore`, infinite fetch) before implementing
- [ ] 2.5 `features/tweets/useTweet.ts`: `useQuery({ queryKey: tweetQueryKey(id), queryFn: () => fetchTweet(id) })` mirroring `useProfile`
- [ ] 2.6 `features/tweets/useReplies.ts`: `useInfiniteQuery` ascending, mirroring `useUserTweets` verbatim except queryFn/key
- [ ] 2.7 Gate: 2.4's tests green
- [ ] 2.8 Write failing tests for `useCreateReply(parentId)` covering: optimistic append to end of last `repliesQueryKey(parentId)` page, `replyCount` +1 patched on `TIMELINE_QUERY_KEY`/`USER_TWEETS_QUERY_PREFIX`/`tweetQueryKey(parentId)`, rollback on error, `onSettled` invalidates only `repliesQueryKey(parentId)` (no redundant replyCount invalidation)
- [ ] 2.9 `features/tweets/useCreateReply.ts`: implement per D5's optimistic sequence (temp id `optimistic-${Date.now()}`, session user as author, `inReplyTo` pointing at parent, `replyCount: 0`)
- [ ] 2.10 Gate: 2.8's tests green
- [ ] 2.11 Gate: `pnpm --filter web test` full run green (existing timeline/profile/composer tests unaffected by the new fields)

## Block 3 — Web UI

Commit: `feat(web): thread page, reply marker, reply count, cascade-aware delete copy`

- [ ] 3.1 `components/icons`: add a chat-bubble/reply icon alongside `HeartIcon`/`TrashIcon` (same SVG/`className` convention)
- [ ] 3.2 Write failing `TweetCard.test.tsx` cases: reply count/link renders and points to `/t/:id`; "Replying to @user" marker renders and links to `/t/:parentId` when `inReplyTo` is non-null; marker absent when `inReplyTo` is null; delete-confirmation copy branches on `replyCount` (cascade-aware text vs today's plain copy)
- [ ] 3.3 `TweetCard.tsx`: render reply count/button (`<Link to={/t/${tweet.id}}>`, `aria-label` per D6, mirrors like button structure); render "Replying to @user" marker above content when `inReplyTo` non-null; update `handleDelete` confirm copy to branch on `replyCount`
- [ ] 3.4 Gate: 3.2's `TweetCard` tests green
- [ ] 3.5 Write failing `ThreadPage.test.tsx` covering the 6 web-spec scenarios: root+replies render in order, infinite scroll loads next page, zero-replies shows only root (no error state), unknown id shows not-found state, posting a reply appears in the list and bumps the parent's displayed count, loading/error states use the documented `data-testid`s (`thread-not-found`, `thread-error`) and roles (`status`/`alert`)
- [ ] 3.6 `features/tweets/ThreadPage.tsx`: compose `useTweet`/`useReplies`/`useCreateReply` per D6/D7 — root `TweetCard`, reply composer (Composer variant with `parentId`), replies feed (skeleton/`role="status"`, `role="alert"` error, empty state, `IntersectionObserver` sentinel), `useDocumentTitle` (`@{username}'s tweet / TheFlock` loaded, `'Thread / TheFlock'` loading), not-found branch via `ApiError.status === 404`
- [ ] 3.7 `App.tsx`: add `<Route path="/t/:id" element={<ThreadPage />} />` inside the `ProtectedRoute` group
- [ ] 3.8 Gate: 3.5's `ThreadPage` tests green
- [ ] 3.9 Gate: `pnpm --filter web test` full run green; `pnpm --filter web lint` clean (new icon/component follow existing conventions)

## Block 4 — Full gate + live-stack verification

No commit (verification only) — folds into Block 5's archive commit if all green, otherwise fixes land as their own small commits before Block 5.

- [ ] 4.1 `pnpm lint && pnpm format && pnpm typecheck && pnpm test` green across the whole repo
- [ ] 4.2 Walk all 25 spec scenarios (16 `tweets` + 9 `web-tweets`) against the implementation, one by one, marking each covered by an existing automated test or by manual/live-stack check
- [ ] 4.3 Live-stack check via `docker compose up`: register two users, post a tweet, reply to it from the other user, confirm `replyCount` increments on the timeline card, open `/t/:id`, confirm thread order and the "Replying to @user" link round-trip, delete the root tweet and confirm the reply subtree is gone from the timeline/thread (cascade)
- [ ] 4.4 Confirm no CI change is needed — `.github/workflows/ci.yml` already runs `pnpm test`/`pnpm typecheck`/lint across the monorepo; no new job required

## Block 5 — Archive

Commit: `chore(openspec): archive 11-reply-threads`

- [ ] 5.1 Sync delta specs (`specs/tweets`, `specs/web-tweets`) into `openspec/specs/`
- [ ] 5.2 Archive the change, update `state.yaml`
