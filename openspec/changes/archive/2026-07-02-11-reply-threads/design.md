# Design: 11-reply-threads

Decisions D1–D9 are binding for tasks/apply. The proposal is the approved source of truth; where it is imprecise against the real code, the correction is called out inline (see D2 and D4). The user's approved product decision — replies appear in the home timeline and profiles, with a "Replying to @user" marker for context — is assumed throughout.

## D1 — Replies reuse `POST /tweets` with an optional `parentId`; parent-missing is 404; reply-to-a-reply is allowed

`CreateTweetDto` gains an optional `parentId` (`@IsOptional() @IsString()`, no length/format constraint beyond string — cuid validation is the DB's job via the existence check). The controller passes `dto.parentId` through; `TweetsService.create` becomes `create(authorId, content, parentId?)`. When `parentId` is present, the service resolves the parent with a `findUnique({ where: { id }, select: { id: true } })` and throws `NotFoundException('Parent tweet not found')` if absent, then persists `{ authorId, content, parentId }`. When `parentId` is absent the path is byte-for-byte today's behavior.

**404, not 400** — this matches the codebase's established convention: `LikesService.resolveTweet` and `TweetsService.delete` both answer a missing tweet with `NotFoundException('Tweet not found')`; `400 BadRequest` is reserved for malformed input the request itself got wrong (the invalid-cursor guard). A non-existent `parentId` is a missing resource, not a malformed field. Rejected alternative: 400 — would split the "tweet not found" semantic across two status codes for no caller benefit.

**Reply-to-a-reply is allowed and bound as intended.** The schema's `parent`/`replies` self-relation has no depth constraint, and existence validation only checks that the parent row exists — it does not check that the parent is itself top-level. A reply can therefore be replied to at arbitrary depth (the data model already supports it; the flat *view* in D6 is the only place depth is deliberately not surfaced). Rejected alternative: reject replies whose parent has a non-null `parentId` (enforce one level) — adds a query and a rule the product explicitly does not want (deeper conversations are reachable one hop at a time via `/t/:replyId`).

## D2 — `PublicTweet` gains `replyCount` and `inReplyTo`; one shared Prisma include produces both

Shared contract additions (additive, non-breaking — no consumer reads them yet):

```ts
export interface PublicTweet {
  // …existing fields…
  replyCount: number;
  inReplyTo: { id: string; username: string } | null;
}
export interface CreateTweetRequest {
  content: string;
  parentId?: string;
}
```

`inReplyTo` is projected from the parent relation **in the same query — no N+1** — and `replyCount` from `_count.replies` alongside the existing `_count.likes`. To keep the projection from drifting across the four read sites (`create`, `paginateTweets`, `getById`, `listReplies`), introduce a single shared include constant in `tweets.service.ts`, mirroring the `USER_SUMMARY_SELECT` pattern already established in `users/user-summary.ts`:

```ts
const TWEET_INCLUDE = {
  author: AUTHOR_SELECT,
  _count: { select: { likes: true, replies: true } },
  parent: { select: { id: true, author: { select: { username: true } } } },
} as const;
```

The row interface (`TweetWithAuthor`) grows `_count.replies: number` and `parent: { id: string; author: { username: string } } | null`. `toPublicTweet` maps:

```ts
replyCount: tweet._count.replies,
inReplyTo: tweet.parent ? { id: tweet.parent.id, username: tweet.parent.author.username } : null,
```

**Proposal correction (precision, not a defect):** the proposal says "the timeline query is untouched." The `where`/filter for timeline and profile is untouched — replies are *not* filtered out, per the user decision. But the *projection* (`include`) changes for **every** tweet read in the app, timeline included, because `TWEET_INCLUDE` is the single source. The design binds: projection change is global; filter change is none. Rejected alternative: inline the include at each call site — guarantees drift the moment one site is edited, which is exactly what `USER_SUMMARY_SELECT` was created to prevent.

## D3 — `paginateTweets` generalized with an explicit order direction, kept as a private method

`paginateTweets` today hard-codes `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`. The replies list is the app's second cursor-paginated resource and reads ascending (oldest-first). The extraction the architecture review earmarked is realized by parameterizing the existing helper with an order direction, not by forking it:

```ts
private async paginateTweets(
  sessionUserId: string,
  where: Prisma.TweetWhereInput,
  { cursor, limit = 20, order = 'desc' }: { cursor?: string; limit?: number; order?: 'asc' | 'desc' },
): Promise<CursorPage<PublicTweet>>
```

`orderBy` becomes `[{ createdAt: order }, { id: order }]`. Everything else is preserved verbatim: the up-front invalid-cursor guard (Prisma misbehaves on a cursor id matching no row), `take: limit + 1` / `hasMore` slicing, the batched `like.findMany` → `likedSet` lookup, and `nextCursor` derivation. `timeline` and `listByUsername` call it exactly as today (order defaults to `'desc'` — their call sites are unchanged); `listReplies` passes `order: 'asc'`.

**Kept as a private method, not promoted to a module-level util.** The helper depends on `this.prisma` and `this.toPublicTweet`; a module-level function would have to receive both as arguments at every call, adding ceremony for zero reuse benefit — no service other than `TweetsService` paginates tweets. A private method already *is* the reusable unit within the only consumer. Rejected alternative: extract to `tweets/paginate.ts` taking `(prisma, mapper, …)` — speculative generality the proposal explicitly warns against ("not speculatively"). If a second service ever needs it, that is the moment to promote it.

Cursor pagination is direction-agnostic in Prisma: `cursor: { id } , skip: 1` with `take: limit + 1` walks forward in whatever `orderBy` direction is set, so the ascending replies case needs no special cursor handling — only the `orderBy` flips.

## D4 — `GET /tweets/:id` and `GET /tweets/:id/replies`; TimelineQueryDto reused; static routes declared before `:id`

Two new service methods and two controller routes:

- `getById(sessionUserId, id)` → `findUnique({ where: { id }, include: TWEET_INCLUDE })`; `NotFoundException('Tweet not found')` if absent; `likedByMe` computed by a single `like.findUnique`/`count` for `(sessionUserId, id)`. Returns one `PublicTweet` (the thread root).
- `listReplies(sessionUserId, id, opts)` → validate the parent exists first (404 — same message/convention), then `return this.paginateTweets(sessionUserId, { parentId: id }, { ...opts, order: 'asc' })`.

**Query DTO: reuse `TimelineQueryDto`.** Its shape is exactly `{ cursor?, limit (1–50, default 20) }` — nothing timeline-specific about it; it is already a generic cursor-page query. Reusing it for `GET /tweets/:id/replies` avoids a near-identical `RepliesQueryDto`. Rejected alternatives: (a) a new `RepliesQueryDto` — duplicate validation rules that must be kept in lockstep; (b) rename `TimelineQueryDto` → `CursorPageQueryDto` — cleaner name but touches an unrelated import for a cosmetic gain, out of scope for this change.

**Route ordering pitfall — bound explicitly.** NestJS/Express matches routes in *declaration order*, first match wins. A `@Get(':id')` declared **before** `@Get('timeline')` would swallow `GET /tweets/timeline` (matching with `id = "timeline"`). Therefore in `TweetsController` the declaration order MUST be: `@Post()`, `@Get('timeline')` (static, first), then `@Get(':id')` and `@Get(':id/replies')`, then `@Delete(':id')`. `:id` and `:id/replies` are distinct paths and may be declared in either relative order. Cross-controller: the like routes live in a separate `@Controller('tweets/:tweetId')` (`POST/DELETE :tweetId/like`); those never collide with `GET :id` or `GET :id/replies` (different final segment and/or method), and the differing param name (`:tweetId` vs `:id`) is irrelevant across controllers. This ordering is verified by a controller/e2e test that hits `GET /tweets/timeline` and asserts it is not routed to `getById`.

## D5 — Web data layer: query keys, `useTweet`/`useReplies`, dedicated reply mutation

**Query keys** (added to `lib/queryKeys.ts`, following the established `xQueryKey` naming — not `xKey` — for consistency with `profileQueryKey`/`userTweetsQueryKey`):

```ts
export const TWEET_QUERY_PREFIX = ['tweet'] as const;
export const tweetQueryKey = (id: string) => [...TWEET_QUERY_PREFIX, id] as const;
export const REPLIES_QUERY_PREFIX = ['replies'] as const;
export const repliesQueryKey = (id: string) => [...REPLIES_QUERY_PREFIX, id] as const;
```

**API client** (`features/tweets/api.ts`): `fetchTweet(id)` → `GET /tweets/:id`; `fetchReplies(id, cursor?)` → `GET /tweets/:id/replies` (mirrors `fetchTimeline`'s query-string building); `createTweet` gains an optional `parentId` (already flows through `CreateTweetRequest`).

**Hooks:** `useTweet(id)` → `useQuery({ queryKey: tweetQueryKey(id), queryFn: () => fetchTweet(id) })` (mirrors `useProfile`). `useReplies(id)` → `useInfiniteQuery` ascending, mirroring `useUserTweets` verbatim except the queryFn and key.

**Reply mutation — dedicated `useCreateReply(parentId)`, not an extension of `useCreateTweet`.** `useCreateTweet` prepends to the timeline and is wired to the top-level composer; replies need a different cache shape. Optimistic behavior:

1. **Append** an optimistic reply (temp id `optimistic-${Date.now()}`, session user as author, `inReplyTo` pointing at the parent, `replyCount: 0`) to the *end* of the last page of `repliesQueryKey(parentId)` — ascending/oldest-first means newest goes last.
2. **Bump `replyCount` +1 on the parent tweet wherever it is cached** — `setQueriesData` across `TIMELINE_QUERY_KEY`, `USER_TWEETS_QUERY_PREFIX`, and `setQueryData` on `tweetQueryKey(parentId)` (the thread-root single-tweet cache). This is a deterministic patch, matching the like/delete convention.
3. **onError:** roll back all touched caches (capture previous in `onMutate`).
4. **onSettled:** invalidate **only** `repliesQueryKey(parentId)` — to reconcile the temp-id row against the server's real row (real id/timestamp), exactly as `useCreateTweet` invalidates the timeline for the same fake-id reason. The `replyCount` bumps are **not** invalidated: they are deterministic (+1), so per the recently-adopted "optimistic patch covers it, no redundant onSettled invalidation" convention (see `useToggleLike`/`useDeleteTweet`), leaving them patched is correct.

**The new reply is not optimistically inserted into the home timeline.** A reply is a tweet and does belong in the author's timeline, but inserting it there would duplicate the temp-id append/reconcile machinery across a third infinite cache for a surface the user is not currently looking at. It surfaces on the timeline's next natural refetch (30 s `staleTime`). Rejected alternative: prepend to the timeline too (like `useCreateTweet`) — more fake-id churn and a second invalidation, disproportionate to the benefit.

**Cascade delete note:** `useDeleteTweet` is unchanged. When a parent is deleted its replies vanish server-side (cascade); the existing timeline/profile caches reconcile on their next fetch. No new invalidation is added for the cascade (the deleted subtree's rows are simply gone on refetch); the UX consequence is owned entirely by the confirmation copy in D6.

## D6 — Thread UI: `/t/:id` route, reply marker everywhere, reply count/button, cascade-aware delete copy

**Route:** add `<Route path="/t/:id" element={<ThreadPage />} />` inside the `ProtectedRoute` group in `App.tsx`. Route-change focus (`main` ref) and the `mx-auto max-w-2xl` shell are already handled by `AppShell`.

**`ThreadPage`** (`features/tweets/ThreadPage.tsx`) composition, top to bottom:
- Root tweet via `useTweet(id)` rendered with `TweetCard` (the root is a normal card; no separate variant is required for the bonus — if visual emphasis is wanted it is a class tweak, not a new component).
- A reply composer (a `Composer` variant driven by `useCreateReply(id)` — same textarea/counter/`MAX_TWEET_LENGTH`/`aria-invalid`/sr-only-label structure as `Composer`, submitting with `parentId`).
- The replies feed via `useReplies(id)` — the same skeleton / `role="status"` loading, `role="alert"` error, empty-state, `IntersectionObserver` sentinel, and `TweetCard` list as `TimelineFeed`. (The infinite-scroll list markup is close enough to `TimelineFeed` that a shared inner list component may be extracted during apply; not mandated here.)
- `useDocumentTitle`: `@${rootTweet.author.username}'s tweet / TheFlock` once loaded, `'Thread / TheFlock'` while loading — following `ProfilePage`'s pattern.

**"Replying to @user" marker on `TweetCard` — everywhere (timeline, profile, thread).** When `tweet.inReplyTo` is non-null, render a small line above the content: `Replying to ` + a `<Link to={/t/${inReplyTo.id}}>@{inReplyTo.username}</Link>` styled like the existing author link (indigo, focus-visible ring). This is a pure function of `inReplyTo`, so it appears identically wherever a `TweetCard` renders — no per-surface prop.

**Reply count/button on `TweetCard`.** A new control mirroring the like button's structure (`min-h-11`, focus ring, tabular-nums count), using a new chat-bubble icon added to `components/icons`. It is a `<Link to={/t/${tweet.id}}>` (not a mutation button) showing `tweet.replyCount`, `aria-label={`${replyCount} replies, open thread`}`. Placed next to the like button.

**Delete confirmation copy — cascade-aware.** `TweetCard.handleDelete` switches on `tweet.replyCount`: `> 0` → `window.confirm(`Delete this tweet and its ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}? This cannot be undone.`)`; `=== 0` → the existing `'Delete this tweet?'`. This surfaces the schema's `onDelete: Cascade` consequence at the exact moment the user is about to trigger it.

## D7 — `/t/:id` for a deleted or unknown tweet: 404 not-found state mirroring `ProfilePage`

`GET /tweets/:id` returns 404 for a missing/deleted tweet, so `useTweet(id).error` is an `ApiError` with `status === 404`. `ThreadPage` distinguishes it exactly as `ProfilePage` distinguishes a missing user:

```ts
const isNotFound = tweet.error instanceof ApiError && tweet.error.status === 404;
```

- `isNotFound` → a calm `data-testid="thread-not-found"` message: `Tweet not found.` (same styling as `profile-not-found`).
- other error → `data-testid="thread-error"` with `role="alert"`: `Could not load this thread. Please try again.`
- loading → skeleton with `role="status"`.

This also covers the cascade case: opening `/t/:replyId` after its parent (and thus the reply) was deleted lands on the same not-found state. The replies feed under a still-existing root has its own independent error/empty states (per D6) and does not gate the root render.

## D8 — Icon and shared-list extraction are apply-time details, not new architecture

A chat-bubble/reply icon is added to `components/icons` alongside `HeartIcon`/`TrashIcon` (same SVG/`className` prop convention). Whether the `TimelineFeed`/thread replies feed share an extracted inner list component is left to apply-time judgment (both are viable; neither changes the contract). Neither is a binding decision — recorded so the tasks phase accounts for them.

## D9 — No notification seams in this change

Change 12 (notifications) consumes the reply-creation path designed in D1. This design deliberately adds **no** hook, event, or seam for it: `create` stays a plain persist. Change 12 will read this design and decide where to observe reply creation. Binding a seam now would be speculative coupling. (Recorded per the orchestrator's instruction that reading this design is sufficient for change 12.)
