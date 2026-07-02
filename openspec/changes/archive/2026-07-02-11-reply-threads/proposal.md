# Proposal: 11-reply-threads — Reply to tweets and read them in a thread

## Intent

Expose the reply relation the DB already models. The `Tweet` model shipped with a `parent`/`replies` self-relation (cascade delete) in the init migration, but nothing above the database uses it: no DTO accepts a `parentId`, no endpoint returns replies, no shared type carries a reply count, no UI lets you reply or open a thread. This change wires that latent capability end-to-end — reply to a tweet, see a reply count on every tweet, open a tweet and read its thread — completing the "Reply threads" bonus.

The database layer is done and untouched. This is purely an api → shared → web exposure, and it forces one honest refactor: `paginateTweets` becomes the app's second cursor-paginated resource, so the private helper gets extracted the way the earlier architecture review flagged.

## Rubric mapping

Bonus (5): "Reply threads: respuestas a tweets con visualización en hilo" pinned in the plan. Funcionalidad (25): reply, count, and thread view are core social-graph features. Calidad (20): the shared-type additions are strictly additive/non-breaking, and the pagination helper is extracted at exactly the moment a second consumer justifies it — not speculatively. Proceso (15): granular commits per block, tests gate every layer (strict TDD).

## Scope

### In Scope
- **Shared contract (additive)**: `PublicTweet` gains `replyCount: number` and `inReplyTo: { id: string; username: string } | null` (the parent's id doubles as the thread link target; the username powers the "Replying to @user" marker); `CreateTweetRequest` gains optional `parentId?: string`. A contract review confirmed additive optional/derived fields are non-breaking (no consumer reads them yet).
- **Reply creation via existing `POST /tweets`**: `CreateTweetDto` accepts optional `parentId`; the service validates the parent exists (404 otherwise) and persists the reply. No new write endpoint.
- **Reply count on every tweet**: add `replies` to the Prisma `_count` selection alongside `likes` (same pattern already in use), surfaced as `replyCount`.
- **`GET /tweets/:id`**: returns a single `PublicTweet` (the thread root), 404 if missing, session-relative `likedByMe`.
- **`GET /tweets/:id/replies`**: cursor-paginated `CursorPage<PublicTweet>`, ascending (oldest-first) reading order. This is the second cursor-paginated list, so `paginateTweets` is extracted into a reusable helper that takes the `where`, order direction, and cursor opts.
- **Replies appear in the home timeline and profile lists** (user decision — early-Twitter model): the timeline query is untouched; every reply card carries a "Replying to @user" context marker (from `inReplyTo`) linking to the parent's thread, so a reply never floats context-free (see Approach for rationale).
- **Web — reply affordance + count**: `TweetCard` shows a reply count/button (mirrors the like control) linking to the thread, plus the "Replying to @user" marker on reply cards; a reply composer posts with `parentId`.
- **Web — thread page**: new route `/t/:id` rendering the root tweet followed by a flat chronological list of its replies (infinite scroll, reusing the timeline pattern).
- **Web — query keys**: register `tweet`/`replies` keys in the centralized `queryKeys.ts`; reply and delete mutations invalidate the right caches.

### Out of Scope (Non-goals)
- **Nesting UI** — replies-of-replies rendered as an indented tree. Data supports arbitrary depth; the UI deliberately does not.
- **Quote tweets** and **media** in replies.
- **Notifications** — "someone replied to you" is change **12**, which depends on this one. Explicitly deferred.
- "Tweets & replies" profile tab, reply-to-reply breadcrumbs, and any thread-context header beyond the single root tweet.

## Approach

### Flat thread rendering (not nested)
The self-relation supports arbitrary depth, and a reply can itself be replied to. But the thread **view** renders a single flat, chronological list of direct replies under the root tweet — Twitter's classic model. Rationale: nested rendering needs recursive fetching, depth caps, indentation math, and collapse controls for a bonus feature; a flat list reuses the existing timeline/`CursorPage` machinery almost verbatim and reads naturally. Deeper conversations are reachable by opening a reply as its own thread root (`/t/:replyId`), so no conversation is lost — it's just navigated one hop at a time.

### Replies included in the home timeline (user decision)
Chosen by the user at proposal approval, against the initially recommended top-level-only filter: replies from people you follow appear inline in the home feed and on profiles — the early-Twitter model, "a reply IS a tweet". More visible activity in a demo feed, one fewer special-cased query (timeline/profile `where` stays untouched). The context problem this creates is solved at the card level: every reply renders a "Replying to @user" marker (powered by `inReplyTo` on `PublicTweet`, selected via the parent relation in the same query — no N+1) that links to the parent's thread. Consequence: the tweets `select` includes a minimal `parent { id, author { username } }` projection.

### Reuse `POST /tweets` for replies
A reply is a tweet with a parent. Reusing the existing create endpoint with an optional `parentId` keeps one write path, one DTO, one optimistic-update shape, and avoids a near-duplicate `POST /tweets/:id/replies` controller. The only added rule is parent-existence validation.

### Extract `paginateTweets`
`paginateTweets` is currently a private method hard-coded to `createdAt desc`. The replies list is cursor-paginated but ascending. Rather than fork it, generalize it into a reusable helper parameterized by `where`, order direction, and cursor opts — the extraction the architecture review earmarked for "when a second cursor-paginated resource appears." Timeline and profile lists keep descending; replies pass ascending.

### Cascade delete is a UX consequence, not new work
The schema already declares `onDelete: Cascade` on the self-relation: deleting a parent tweet deletes all its replies. No code change enables this — but the UI must own the consequence. Deleting a tweet with replies silently removes the whole subtree; the delete confirmation copy should reflect that when a reply count is present.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` | Untouched | relation + `@@index([parentId])` already shipped |
| `packages/shared/src/index.ts` | Modified | `replyCount`/`inReplyTo` on `PublicTweet`; optional `parentId` on `CreateTweetRequest` |
| `apps/api/src/tweets/dto/create-tweet.dto.ts` | Modified | optional validated `parentId` |
| `apps/api/src/tweets/tweets.service.ts` | Modified | parent validation, `_count.replies` + `parent {id, author.username}` projection, extracted pagination helper, `getById`, `listReplies` |
| `apps/api/src/tweets/tweets.controller.ts` | Modified | `GET /tweets/:id`, `GET /tweets/:id/replies` |
| `apps/web/src/features/tweets/api.ts` | Modified | `fetchTweet`, `fetchReplies`, `parentId` on `createTweet` |
| `apps/web/src/features/tweets/TweetCard.tsx` | Modified | reply count/button, thread link, delete copy |
| `apps/web/src/features/tweets/*` | New/Modified | thread page + hooks (`useTweet`, `useReplies`, reply composer) |
| `apps/web/src/lib/queryKeys.ts` | Modified | `tweet`/`replies` keys |
| `apps/web/src/App.tsx` | Modified | `/t/:id` route |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reply cards in the feed read as noise without context | Med | User decision documented; every reply card renders "Replying to @user" (from `inReplyTo`, joined in the same query — no N+1) linking to the thread |
| `paginateTweets` extraction is a blast-radius refactor touching timeline + profile paths | Med | Extract with behavior-preserving tests for the existing descending callers first, then add the ascending replies caller; strict-TDD gate on the whole tweets suite |
| Cascade delete removes a subtree the user didn't realize they were deleting | Low | Delete confirmation copy surfaces reply count; documented as intended schema behavior |
| Ascending vs descending order + cursor edge cases in the generalized helper | Low | Helper takes an explicit direction; cursor-validation logic (invalid-cursor guard) preserved; scenarios cover both orders |
| Optimistic reply insert vs `replyCount` on the parent card drift | Low | Reply mutation invalidates both the replies list and the parent tweet/timeline caches |

## Block-level Shape

Task breakdown is deferred to the tasks phase; the intended block order is:

0. **Shared contract** — additive type changes; the seam everything else compiles against.
1. **API** — DTO `parentId`, parent validation, `_count.replies` + `inReplyTo` projection, extract pagination helper, `getById` + `listReplies`; controller endpoints.
2. **Web data layer** — api client functions, query keys, `useTweet`/`useReplies`/reply mutation.
3. **Web UI** — reply count/button + thread link on `TweetCard`, `/t/:id` thread page, reply composer, delete-copy update.
4. **Verify** — spec scenarios green end-to-end; timeline/profile behavior confirmed unchanged except the intended top-level filter.

## Dependencies

None new. Blocks change **12-notifications**, which consumes the reply-creation path.

## Success Criteria

- [ ] `POST /tweets` with a valid `parentId` creates a reply; an unknown `parentId` returns 404; omitting it behaves exactly as today.
- [ ] Every `PublicTweet` carries an accurate `replyCount` and, when it is a reply, an `inReplyTo` with the parent's id and author username.
- [ ] `GET /tweets/:id` returns the root tweet (404 if missing); `GET /tweets/:id/replies` returns a cursor page of replies oldest-first.
- [ ] Replies appear in the home timeline and profile lists, always with a "Replying to @user" marker linking to the parent's thread.
- [ ] The web thread page at `/t/:id` shows the root tweet and a flat chronological reply list with infinite scroll; a reply can be posted from it and appears immediately.
- [ ] Deleting a tweet with replies removes the subtree; the confirmation reflects the reply count.
- [ ] `paginateTweets` is a single reusable helper serving timeline, profile, and replies; all existing tweet tests still pass. Notifications remain out of scope.
