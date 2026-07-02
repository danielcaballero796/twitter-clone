# Proposal: 12-notifications — Persistent Notifications

## Intent

Users have no way to discover interactions with their content — a like, reply, or new follower is invisible unless they manually revisit their tweets or profile. Persistent notifications close the core social feedback loop. Real-time push is deliberately deferred: persistence must exist first (a notification you only get while connected is useless).

**Rubric impact**: Funcionalidad 25 (new core feature), Testing 25 (full TDD suites), Calidad 20 (new bounded module), Proceso 15 (SDD cycle), Bonus 5 (foundation for 13-realtime).

## Scope

### In Scope
- Prisma `Notification` model: `type` (LIKE | REPLY | FOLLOW), `recipientId`, `actorId`, optional `tweetId`, `read`, `createdAt`; cascade-deleted with user/tweet
- Fan-out on action: like, reply, and follow creation produce a notification for the affected user (never for self-actions); unlike/unfollow removes its notification
- API: `GET /notifications` (cursor pagination, newest first), `GET /notifications/unread-count`, `PATCH /notifications/read` (mark all read)
- `packages/shared`: `PublicNotification` + request/response types
- Web: `/notifications` page (infinite feed, mark-read on visit), nav badge with unread count via TanStack Query polling-free refetch defaults
- Seed data: demo notifications

### Out of Scope
- Real-time delivery (SSE/WebSocket) → change 13-realtime
- Email/push channels, notification preferences/muting
- Aggregation ("Alice and 3 others liked…")

## Approach

New `notifications` NestJS module owning the table; existing `likes`/`tweets`/`follows` services call `NotificationsService.create/remove` inside their existing operations (recipient derived from `tweet.authorId` or `followingId`). Web mirrors the established feature pattern: `useInfiniteQuery` + cursor, feature folder, MSW handlers.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` + migration | New | `Notification` model (additive) |
| `apps/api/src/notifications/` | New | module, controller, service, DTOs |
| `apps/api/src/{likes,tweets,follows}/` | Modified | fan-out calls |
| `packages/shared/src/index.ts` | Modified | notification contract |
| `apps/web/src/features/notifications/` | New | page, hooks, tests |
| `apps/web/src/App.tsx`, nav components | Modified | route + unread badge |
| `apps/api/prisma/seed.ts` | Modified | demo notifications |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Circular module deps (likes/tweets/follows → notifications) | Med | one-way dependency: only `NotificationsService` is imported; it imports nothing domain-side |
| Fan-out drifts from source actions (orphan/missing notifications) | Med | unit + e2e specs per action pair (create/undo); cascade covers deletions |
| Unread-count staleness on the badge | Low | invalidate on mutations + refetch on window focus (Query defaults) |

## Rollback Plan

Revert the change's commits. The migration is additive (single new table, no altered columns) — `DROP TABLE "Notification"` down-migration restores the prior schema. Existing endpoint contracts are untouched (fan-out is service-internal), so reverting cannot break other features.

## Dependencies

- None external. Builds on existing likes/follows/replies (changes 04, 06, 11 — all archived).

## Success Criteria

- [ ] Liking, replying, or following produces exactly one notification for the right recipient; self-actions produce none
- [ ] Unlike/unfollow removes the corresponding notification; deleting a tweet cascades its notifications
- [ ] `/notifications` page lists newest-first with working infinite scroll; badge shows unread count and clears after visit
- [ ] Full gate green: lint, typecheck, api + web suites, coverage ≥85%
