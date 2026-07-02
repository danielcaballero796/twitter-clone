# Design: 12-notifications

## Technical Approach

New `Notification` table owned by a new `notifications` NestJS module. Likes/tweets/follows services call `NotificationsService` directly (one-way dependency) at their existing write sites. Listing reuses the codebase's cursor-pagination idiom. Web mirrors the established feature pattern (feature folder, `useInfiniteQuery`, MSW), with a nav badge fed by an unread-count query.

## Architecture Decisions

### D1: Direct service call, not event emitter
**Choice**: `LikesService`/`TweetsService`/`FollowsService` inject `NotificationsService` (exported by `NotificationsModule`, imported by the three modules). `NotificationsService` depends only on `PrismaService` (global) — no cycle possible.
**Alternatives**: Nest `EventEmitter2` decoupling.
**Rationale**: three call sites, one consumer; an event bus adds indirection and async test complexity with zero benefit until change 13.

### D2: Model shape
```prisma
enum NotificationType { LIKE REPLY FOLLOW }
model Notification {
  id          String  @id @default(cuid())
  type        NotificationType
  recipient   User    @relation("notificationsReceived", fields: [recipientId], references: [id], onDelete: Cascade)
  recipientId String
  actor       User    @relation("notificationsSent", fields: [actorId], references: [id], onDelete: Cascade)
  actorId     String
  tweet       Tweet?  @relation(fields: [tweetId], references: [id], onDelete: Cascade)
  tweetId     String?
  read        Boolean @default(false)
  createdAt   DateTime @default(now())
  @@index([recipientId, createdAt(sort: Desc)])
  @@index([recipientId, read])
  @@index([tweetId])
}
```
Cascades satisfy the deletion spec for free (tweet delete removes LIKE/REPLY notifications; user delete removes both directions).

### D3: Sequential fan-out guarded by created count — not a transaction
**Choice**: notification write happens after the action write. For likes, `createMany` returns `count`; notify only when `count > 0` (repeat likes and the concurrent double-like race produce exactly one notification). Reply/follow already dedupe upstream (404 guard / `skipDuplicates` + self-follow 400).
**Alternatives**: interactive `$transaction`.
**Rationale**: codebase uses no transactions today; worst failure is a missing/orphan notification on a crash between writes — acceptable for this domain, and the simplicity keeps the riskiest surface (existing action paths) untouched.

### D4: Recipient/tweet derivation
- Like → recipient `tweet.authorId` (extend `resolveTweet` select with `authorId`); `tweetId` = liked tweet.
- Reply → recipient parent's `authorId` (extend the existing parent lookup select); `tweetId` = **the reply's id**, so the web link opens `/t/:replyId`, which already renders the "Replying to @user" context.
- Follow → recipient `followingId`, `tweetId` null. Self-action guard: skip when `actorId === recipientId`.

### D5: Undo removal by composite where
`unlike` → `deleteMany({ type: LIKE, actorId, tweetId })`; `unfollow` → `deleteMany({ type: FOLLOW, actorId, recipientId })`. Idempotent, no id bookkeeping. Reply undo needs nothing — deleting the reply cascades via `tweetId`.

### D6: Own `ListNotificationsQueryDto`, own paginator
**Choice**: duplicate the small cursor/limit DTO and mirror `paginateTweets`' shape (orderBy `[createdAt desc, id desc]`, invalid-cursor 400, `take: limit + 1`) inside the notifications module.
**Alternatives**: import `TimelineQueryDto` from tweets.
**Rationale**: a cross-domain DTO import couples notifications to tweets for ~15 lines; module boundary wins.

### D7: Badge + mark-read (web)
Keys: `NOTIFICATIONS_QUERY_KEY = ['notifications','list']`, `UNREAD_COUNT_QUERY_KEY = ['notifications','unread-count']` in `lib/queryKeys.ts`. `NotificationsNavLink` (pattern: `ProfileNavLink`) renders the badge from `useUnreadCount` (default staleTime 30s + focus refetch; live push arrives in change 13). `NotificationsPage` fires `useMarkRead` once on mount: optimistic `setQueryData(count → 0)`, rollback on error, `onSettled` invalidates both keys.

## Data Flow (like)

```
POST /tweets/:id/like → LikesService.like
  resolveTweet(select id, authorId) → like.createMany(skipDuplicates)
  count>0 && authorId!==userId → NotificationsService.create(LIKE, ...)
GET /notifications ──→ NotificationsService.list → cursor page, actor via USER_SUMMARY_SELECT
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` + migration | Modify | enum + Notification model (additive) |
| `apps/api/src/notifications/*` (module, controller, service, DTO, specs) | Create | endpoints + fan-out API |
| `apps/api/src/likes/likes.{service,module}.ts` | Modify | fan-out + import |
| `apps/api/src/tweets/tweets.{service,module}.ts` | Modify | reply fan-out + import |
| `apps/api/src/follows/follows.{service,module}.ts` | Modify | fan-out + import |
| `apps/api/src/app.module.ts` | Modify | register NotificationsModule |
| `packages/shared/src/index.ts` | Modify | `NotificationType`, `PublicNotification`, `UnreadCountResponse` |
| `apps/web/src/lib/queryKeys.ts` | Modify | two new keys |
| `apps/web/src/features/notifications/*` (api, hooks, page, nav link, tests) | Create | feed, badge, mark-read |
| `apps/web/src/App.tsx`, `src/test/msw/handlers.ts`, `apps/api/prisma/seed.ts` | Modify | route + nav, handlers, demo data |

## Interfaces

```ts
export type NotificationType = 'LIKE' | 'REPLY' | 'FOLLOW';
export interface PublicNotification {
  id: string; type: NotificationType; read: boolean; createdAt: string;
  actor: UserSummary; tweetId: string | null;
}
export interface UnreadCountResponse { count: number; }
// GET /notifications → CursorPage<PublicNotification> (existing generic)
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (api) | fan-out per action pair, self-action skip, list/count/mark-read, invalid cursor | Jest service specs against `twitter_test`, failing-first |
| E2E (api) | full flow: like/reply/follow → list → unread → mark-read → undo/cascade | Supertest |
| Unit (web) | hooks (infinite feed, count, optimistic mark-read rollback), page states, badge | Vitest + MSW, failing-first |

## Migration / Rollout

One additive migration. No backfill (history starts at deploy). Rollback = drop table + enum.

## Open Questions

None — all bound above.
