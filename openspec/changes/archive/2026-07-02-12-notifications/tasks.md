# Tasks: 12-notifications

Blocks (4 commits + verify + archive). Strict TDD: failing tests land before the implementation inside each block; tests ship in the same commit as the feature.

## Block 0 — Shared contract

Commit: `feat(shared): add notification types to the contract`

- [x] 0.1 `packages/shared/src/index.ts`: add `NotificationType`, `PublicNotification` (id, type, read, createdAt, actor: UserSummary, tweetId | null), `UnreadCountResponse`
- [x] 0.2 Gate: `pnpm typecheck` green (additive change)

## Block 1 — API

Commit: `feat(api): notification fan-out, listing, unread count, and mark-read`

- [x] 1.1 `schema.prisma`: `NotificationType` enum + `Notification` model per D2 (cascade FKs, 3 indexes); `prisma migrate dev` (additive)
- [x] 1.2 Write failing service specs (`notifications.service.spec.ts`): create/list newest-first, cursor pagination + invalid-cursor 400, own-notifications isolation, unreadCount, markAllRead (idempotent, per-user)
- [x] 1.3 `src/notifications/`: module (exports service), `NotificationsService` (create with self-action skip, removeLike, removeFollow, list mirroring `paginateTweets`, unreadCount, markAllRead), `ListNotificationsQueryDto` (D6), `toPublicNotification` with `USER_SUMMARY_SELECT`
- [x] 1.4 `NotificationsController`: `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/read`; register module in `app.module.ts`
- [x] 1.5 Gate: 1.2 specs green
- [x] 1.6 Write failing fan-out specs in `likes.service.spec.ts` / `tweets.service.spec.ts` / `follows.service.spec.ts`: notification created per action (spec scenarios 1-3), self-action skip, repeat-like no duplicate (count guard, D3), unlike/unfollow removal (D5)
- [x] 1.7 Wire fan-out: `LikesService.like/unlike` (extend `resolveTweet` select with `authorId`), `TweetsService.create` (extend parent select with `authorId`), `FollowsService.follow/unfollow`; import NotificationsModule in the three modules
- [x] 1.8 Gate: 1.6 specs green
- [x] 1.9 Write failing e2e (`notifications.e2e-spec.ts`): full flow like+reply+follow → list → unread-count → mark-read → unlike removal → tweet-delete cascade; 401 unauthenticated
- [x] 1.10 Implement remaining gaps from 1.9 (expect none — cascade is schema-level)
- [x] 1.11 `prisma/seed.ts`: seed demo notifications (like + reply + follow between seeded users)
- [x] 1.12 Gate: `pnpm --filter api test` all green (`--runInBand`), coverage ≥85%

## Block 2 — Web data layer

Commit: `feat(web): notification query keys, api client fns, and hooks`

- [x] 2.1 `lib/queryKeys.ts`: `NOTIFICATIONS_QUERY_KEY`, `UNREAD_COUNT_QUERY_KEY` (D7)
- [x] 2.2 `features/notifications/api.ts`: `fetchNotifications(cursor?)`, `fetchUnreadCount()`, `markAllRead()`; MSW handlers for the three endpoints (paginated, empty, error cases)
- [x] 2.3 Write failing hook tests: `useNotifications` (pages, hasMore), `useUnreadCount` (count), `useMarkRead` (optimistic count→0, rollback on error, onSettled invalidates both keys)
- [x] 2.4 Implement `useNotifications` (mirror `useReplies`), `useUnreadCount`, `useMarkRead` per D7
- [x] 2.5 Gate: `pnpm --filter web test` green

## Block 3 — Web UI

Commit: `feat(web): notifications page and nav unread badge`

- [x] 3.1 Write failing `NotificationsNavLink.test.tsx`: badge with count, hidden at zero
- [x] 3.2 `features/notifications/NotificationsNavLink.tsx` (pattern: `ProfileNavLink`) + bell icon in `components/icons.tsx`; mount in `App.tsx` nav
- [x] 3.3 Write failing `NotificationsPage.test.tsx` per the 9 web-spec scenarios: newest-first feed, infinite scroll, per-type rendering + links (LIKE/REPLY → `/t/:id`, FOLLOW → `/u/:username`), mark-read on mount clears badge, loading `role="status"` / error `role="alert"` + retry / empty state
- [x] 3.4 `features/notifications/NotificationsPage.tsx` composing the three hooks; route `/notifications` in `App.tsx` inside `ProtectedRoute`; `useDocumentTitle`
- [x] 3.5 Gate: `pnpm --filter web test` full run green; `pnpm --filter web lint` clean

## Block 4 — Full gate + live-stack verification

No commit — fixes land as their own commits if anything surfaces.

- [x] 4.1 `pnpm lint && pnpm format && pnpm typecheck && pnpm test` green repo-wide
- [x] 4.2 Walk the 26 spec scenarios, mark each covered by an automated test or live check
- [x] 4.3 Live stack (`docker compose up`): two users; like+reply+follow → badge count, list order, links; mark-read clears badge; unlike removes item; delete tweet cascades
- [x] 4.4 Confirm CI needs no change (monorepo scripts already cover new suites)

## Block 5 — Archive

Commit: `chore(openspec): archive 12-notifications and sync notification specs`

- [x] 5.1 Sync `specs/notifications` + `specs/web-notifications` into `openspec/specs/`
- [x] 5.2 Move change to `openspec/changes/archive/2026-07-02-12-notifications/`, finalize `state.yaml`
