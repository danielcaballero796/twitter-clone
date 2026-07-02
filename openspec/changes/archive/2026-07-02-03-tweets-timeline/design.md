# Design: 03-tweets-timeline — Tweet CRUD + Timeline

## Technical Approach

New `TweetsModule` mirrors the auth domain pattern: one controller per domain, class-validator DTOs, a service throwing Nest `HttpException`s, `PrismaService` via DI. The global `JwtAuthGuard` already protects every route, so `req.user.sub` is the author on write and the timeline subject on read — no `@Public()` here. Timeline resolves `authorId IN (followedIds + selfId)` (followed ids from the `Follow` table, seeded in tests until change 04) and paginates with **Prisma-native cursor** on the compound index `[authorId, createdAt desc]`. Author is embedded via Prisma `select` to kill N+1 on the web feed. Frontend adds `features/tweets` on the existing `request<T>` wrapper + TanStack Query; `useInfiniteQuery` consumes `nextCursor`. Satisfies specs `tweets` and `web-tweets`.

## Architecture Decisions

| Decision | Options | Choice + Rationale |
|----------|---------|--------------------|
| Cursor strategy | Prisma-native `cursor:{id}` vs base64 composite `(createdAt,id)` | **Prisma-native** — SPIKE against pinned Prisma 6.19.3 on the real test DB PASSED: with `orderBy:[{createdAt:'desc'},{id:'desc'}]`, `cursor:{id}`, `skip:1`, `take:limit+1`, three tweets sharing an identical `createdAt` split across a page boundary with **zero dupes and zero gaps**. Unique `id` disambiguates ties, so the simpler opaque-id cursor is correct. Composite base64 fallback NOT needed. |
| nextCursor shape | opaque id vs `{createdAt,id}` blob | **Opaque = last item's `id`**. `take:limit+1` peeks the next row → `nextCursor` is the last kept item's id when a spare exists, else `null`. |
| Author payload | embed via `select` vs separate fetch | **Embed** `author:{ select:{id,username,displayName} }`, map `avatarUrl` in a `toPublicTweet` mapper (same dicebear derivation as users). One query, no N+1 on the feed. |
| Delete not-found vs forbidden | 403-only vs 404-then-403 | **404 then 403**: `findUnique`; missing → `NotFoundException`; `authorId !== sub` → `ForbiddenException`. Matches spec ownership requirement. |
| `_count` (likes) | include now vs later | **Omit** — likes are out of scope (change 05+). No `_count` this change. |
| Create cache update | invalidate vs optimistic insert | **Optimistic insert** into page-0 of the infinite cache + rollback on error (ui-standards: optimistic updates); satisfies FE "type→submit→appears". Delete = **optimistic removal**. |

## Data Flow

    POST /tweets ─▶ TweetsController(req.user.sub) ─▶ TweetsService.create ─▶ Prisma ─▶ toPublicTweet
    GET /tweets/timeline?cursor&limit ─▶ Service: followedIds=Follow.findMany(followerId=sub)
        └▶ tweet.findMany({ where:{authorId:{in:[...ids, sub]}}, orderBy, cursor?, skip?, take:limit+1 })
        └▶ { items: PublicTweet[], nextCursor: string|null }
    web: useTimeline(useInfiniteQuery) ◀─ IntersectionObserver sentinel ─ TimelineFeed ─ TweetCard

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/tweets/tweets.module.ts` | Create | wires controller+service, imports PrismaModule |
| `apps/api/src/tweets/tweets.controller.ts` | Create | `POST /tweets`, `DELETE /tweets/:id`, `GET /tweets/timeline` |
| `apps/api/src/tweets/tweets.service.ts` | Create | create/delete/timeline + `toPublicTweet` mapper |
| `apps/api/src/tweets/dto/create-tweet.dto.ts` | Create | `content` `@IsString @Length(1,280)` |
| `apps/api/src/tweets/dto/timeline-query.dto.ts` | Create | `cursor?` `@IsString`; `limit` `@Type(Number) @IsInt @Min(1) @Max(50)` default 20 |
| `apps/api/src/app.module.ts` | Modify | register `TweetsModule` |
| `apps/api/test/tweets.e2e-spec.ts` | Create | create/delete/ownership/timeline pagination (seeded Follow) |
| `packages/shared/src/index.ts` | Modify | `TweetAuthor`, `PublicTweet`, `CreateTweetRequest`, `CursorPage<T>` |
| `apps/web/src/features/tweets/{api,useTimeline,useCreateTweet,useDeleteTweet}.ts` | Create | fetch + 3 hooks |
| `apps/web/src/features/tweets/{Composer,TweetCard,TimelineFeed}.tsx` | Create | composer(char counter), card(relative ts, delete on own), feed(infinite scroll, empty-state) |
| `apps/web/src/features/auth/HomePage.tsx` | Modify | render `<TimelineFeed>` (preserve existing test data-testids) |
| `apps/web/src/test/msw/handlers.ts` | Modify | tweets + timeline handlers |

## Interfaces / Contracts

```ts
interface TweetAuthor { id: string; username: string; displayName: string; avatarUrl: string; }
interface PublicTweet { id: string; content: string; createdAt: string; author: TweetAuthor; }
interface CreateTweetRequest { content: string; }
interface CursorPage<T> { items: T[]; nextCursor: string | null; }
```

Errors: **400** invalid DTO / unusable cursor (nonexistent id → Prisma throws, catch → `BadRequestException`) · **401** missing/invalid token (global guard) · **403** deleting another user's tweet · **404** deleting a nonexistent tweet. Nest default body `{statusCode,message,error}`.

## Testing Strategy (TDD order = commit order)

| # | Layer | What | How |
|---|-------|------|-----|
| 1 | Unit | Service create (author=sub, mapper), 1–280 bounds | Jest, real `twitter_test` DB |
| 2 | Unit | Delete 404 missing, 403 non-owner, 200 owner | Jest |
| 3 | Unit | Timeline: self+followed set, order, `nextCursor`/last-page/empty, bad cursor→400 | Jest, seed Follow rows |
| 4 | E2E | **Mandatory** register→login→create→timeline shows it; delete ownership 403; paginate 2 pages | Supertest agent, seed Follow via `prisma` |
| 5 | Web | Create flow (type→submit→appears, optimistic), delete-own-only, empty-state | Vitest + TL + MSW |

Coverage ≥85% (service/controller; `.dto.ts`/`.module.ts` excluded). E2E seeds `Follow` rows directly (no Follow API until 04).

## Migration / Rollout

No DB migration — schema final from change 01, indexes `[authorId, createdAt desc]` already present. Purely additive: new module + one edited api file, new FE feature + one edited page. Revert feature commits to restore prior state.

## Open Questions

- None blocking. Spike resolved the cursor risk (native cursor confirmed correct).
