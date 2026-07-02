# Proposal: 03-tweets-timeline — Tweet CRUD + Timeline

## Intent

Ship the core social feature: users create and delete tweets and read a reverse-chronological timeline of followed users' + their own tweets. This is the product's reason to exist and the heaviest-weighted rubric line (Funcionalidad 25). Built test-first (strict TDD) to hold the 85% backend coverage gate and satisfy the challenge's mandatory create-tweet integration test (backend) and create-tweet flow test (frontend).

## Rubric mapping

Funcionalidad (25): tweet CRUD + timeline end-to-end. Testing (25): unit + mandatory E2E create-tweet + FE create-flow test. Calidad (20): domain module, validated DTOs, cursor pagination. Proceso (15): tests in same commit, granular conventional commits.

## Scope

### In Scope
- **Backend** `apps/api/src/tweets`: `POST /tweets` (content 1–280 chars, validated, author = session user, 201 + shape), `DELETE /tweets/:id` (ownership check → 403 on others'), `GET /tweets/timeline` (followed + own tweets, `createdAt desc, id desc`, cursor pagination `?cursor=&limit=`).
- Cursor pagination: Prisma-native `cursor: { id }` + `skip: 1` + compound `orderBy`, `take: limit + 1` to compute `nextCursor`/`hasMore`; opaque cursor = tweet id. Base64 composite cursor is the documented fallback if a spike shows Prisma misbehaves with the pinned version.
- `packages/shared`: `PublicTweet`/`TweetDto`, `CreateTweetRequest`, `CursorPage<T>` (timeline response) types.
- **Frontend** `apps/web/src/features/tweets`: composer (mobile-first, char counter), infinite-scroll feed via `useInfiniteQuery`, delete button on own tweets only, empty-state with CTA (no global-feed fallback). Wire into `HomePage.tsx` (replaces placeholder).

### Out of Scope
- **Follow/Unfollow API** — stays in change 04. Timeline follow-filtering is tested by seeding `Follow` rows directly in the DB in e2e. New users see only their own tweets until 04.
- Replies/threads (`parentId`), likes, retweets, search, profile lists (later changes).
- Edit tweet, media/attachments.

## Approach

Schema is complete from change 01 — **no migration**. New `TweetsModule` mirrors the auth domain pattern: controller per domain, class-validator DTOs, service throwing Nest `HttpException`s, `PrismaService` via DI, global guard already protects routes (no `@Public()` needed). Timeline queries `authorId IN (followedIds + selfId)` — followed ids resolved from `Follow` table (populated via seed in tests until 04). Frontend follows the existing `request<T>` fetch wrapper + TanStack Query patterns; `useInfiniteQuery` consumes `nextCursor`. RED-GREEN-REFACTOR per unit.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/tweets/**` | New | module, controller, service, `create-tweet.dto.ts`, `timeline-query.dto.ts` |
| `apps/api/src/app.module.ts` | Modified | register `TweetsModule` |
| `apps/api/test/tweets.e2e-spec.ts` | New | mandatory create-tweet E2E + delete + ownership + timeline pagination (seeded follows) |
| `packages/shared/src/index.ts` | Modified | `PublicTweet`, `CreateTweetRequest`, `CursorPage<T>` |
| `apps/web/src/features/tweets/**` | New | api.ts, `useTimeline`, `useCreateTweet`, `useDeleteTweet`, Composer, TweetCard, TimelineFeed |
| `apps/web/src/features/auth/HomePage.tsx` | Modified | render timeline feed (check existing HomePage/ProtectedRoute tests first) |
| `apps/web/src/test/msw/handlers.ts` | Modified | tweets/timeline handlers for FE tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prisma `cursor+skip:1` misbehaves with compound `orderBy` on pinned version | Med | Spike in design; base64 composite-cursor fallback documented |
| Coverage dips below 85% (ownership/cursor edge cases untested) | Med | TDD from first commit; unit-test 403, empty page, last page, invalid cursor |
| Empty timeline looks broken (no Follow API yet) | Med | Empty-state CTA component; own tweets always visible |
| HomePage edit breaks existing `HomePage`/`ProtectedRoute` tests | Med | Read those tests before touching; preserve `data-testid` contracts |

## Rollback Plan

Fully additive: new module + one edited api file, new FE feature + one edited page. Revert feature commits; `app.module.ts` and `HomePage.tsx` return to prior state. No migration → no schema rollback. Changes 01/02 stay intact.

## Dependencies

- None new on backend (Prisma, class-validator already present).
- TanStack Query already present (used by auth); `useInfiniteQuery` from same package.
- Change 04 (Follow API) will later populate timeline follows; not blocking here (seeded in tests).

## Success Criteria

- [ ] `POST /tweets` rejects >280 chars (400) and unauthenticated (401); creates with author = session user (201).
- [ ] `DELETE /tweets/:id` deletes own tweet; returns 403 on another user's tweet.
- [ ] `GET /tweets/timeline` returns followed + own tweets in `createdAt desc` order with correct `nextCursor`/`hasMore`; mandatory create-tweet E2E green.
- [ ] Frontend create-tweet flow test passes (type → submit → tweet appears); delete button only on own tweets; empty-state renders for empty timeline.
- [ ] Backend coverage ≥ 85%; conventional commits with tests in same commit.
