# Tasks: 03-tweets-timeline — Tweet CRUD + Timeline

## 0. Setup
- [ ] 0.1 Add shared types to `packages/shared/src/index.ts`: `TweetAuthor`, `PublicTweet`, `CreateTweetRequest`, `CursorPage<T>`

## 1. Tweet creation — commit: `feat(api): add tweet creation with validation + tests`
- [ ] 1.1 RED: `tweets.service.spec.ts` — create() author=sub, `toPublicTweet` mapper, 1-char accepted, 280-char boundary accepted, empty/whitespace rejected (400), 281+ rejected (400). Run → failing
- [ ] 1.2 GREEN: `apps/api/src/tweets/{tweets.module,tweets.service}.ts`, `dto/create-tweet.dto.ts` (`@IsString @Length(1,280)`), `tweets.controller.ts` `POST /tweets`
- [ ] 1.3 REFACTOR: rerun green

## 2. Tweet deletion — commit: `feat(api): add tweet deletion with ownership checks + tests`
- [ ] 2.1 RED: extend `tweets.service.spec.ts` — owner deletes (200), non-owner rejected (403), nonexistent id (404). Run → failing
- [ ] 2.2 GREEN: `tweets.service.ts` delete() — `findUnique`→404, `authorId!==sub`→403, else delete; `tweets.controller.ts` `DELETE /tweets/:id`
- [ ] 2.3 REFACTOR: rerun green

## 3. Timeline + cursor pagination — commit: `feat(api): add tweet timeline with cursor pagination + tests`
- [ ] 3.1 RED: extend `tweets.service.spec.ts` — followed+own set/order (`createdAt desc,id desc`), first page returns N + `nextCursor`, next page no overlap/gap, last page `hasMore=false`/no cursor, invalid cursor→400, empty timeline→`hasMore=false`. Seed `Follow` rows. Run → failing
- [ ] 3.2 GREEN: `tweets.service.ts` timeline() (followedIds + self, `cursor`/`skip:1`/`take:limit+1`, catch bad cursor→`BadRequestException`), `dto/timeline-query.dto.ts`, `tweets.controller.ts` `GET /tweets/timeline`
- [ ] 3.3 REFACTOR: rerun green, `pnpm --filter api test --coverage` ≥85%

## 4. E2E + guard coverage — commit: `test(api): add tweets e2e flow with ownership and auth checks`
- [ ] 4.1 RED: `apps/api/test/tweets.e2e-spec.ts` — register→login→create→timeline shows it (mandatory flow); delete ownership 403; paginate across 2 pages (seed `Follow` via prisma); unauthenticated create/delete/timeline → 401 (global guard, no cookie). Run → failing
- [ ] 4.2 GREEN: register `TweetsModule` in `apps/api/src/app.module.ts`; fix any gaps surfaced by e2e
- [ ] 4.3 REFACTOR: `pnpm --filter api test:e2e` green

## 5. Web tweets API + hooks — commit: `feat(web): add tweets api client and query hooks`
- [ ] 5.1 Add `apps/web/src/test/msw/handlers.ts` tweets/timeline handlers (paginated, create, delete)
- [ ] 5.2 `apps/web/src/features/tweets/{api.ts,useTimeline.ts,useCreateTweet.ts,useDeleteTweet.ts}` — `useInfiniteQuery` w/ `nextCursor`, optimistic insert/rollback on create, optimistic removal on delete

## 6. Web composer + feed — commit: `feat(web): add composer, timeline feed and tweet card + tests`
- [ ] 6.1 RED: `Composer.test.tsx` — char counter live update, submit disabled/error over 280 chars. `TimelineFeed.test.tsx` — initial page on mount, next page on scroll (IntersectionObserver), loading indicator in-flight, error state on failure, empty-state CTA on zero items, delete button only on own tweets, confirmed delete removes (optimistic). Run → failing
- [ ] 6.2 GREEN: `apps/web/src/features/tweets/{Composer,TweetCard,TimelineFeed}.tsx`; wire `<TimelineFeed>` into `apps/web/src/features/auth/HomePage.tsx` (preserve existing test ids)
- [ ] 6.3 REFACTOR: `pnpm --filter web test` green

## 7. Final verification
- [ ] 7.1 `pnpm test` + `pnpm build` (all workspaces) green; api coverage ≥85% (dto/module excluded); lint/format/typecheck clean
- [ ] 7.2 Push; confirm CI green (`gh pr checks`) — left for orchestrator

## Scenario Coverage Checklist (26/26)
- **Tweets API — Creation (5)** [G1]: Successful creation; 280-char boundary; empty rejected; over-limit rejected; unauthenticated rejected(G4)
- **Tweets API — Deletion (4)** [G2]: Owner deletes; non-owner 403; nonexistent 404; unauthenticated rejected(G4)
- **Tweets API — Timeline (7)** [G3]: Followed+own order; first page pagination; next page continues; last page no cursor; invalid cursor 400; empty timeline; unauthenticated rejected(G4)
- **Web — Composer (3)** [G6]: Create appears in timeline; char counter live; submission blocked over limit
- **Web — Infinite scroll (2)** [G6]: Initial page on mount; next page on scroll
- **Web — Deletion (2)** [G6]: Delete control own-tweets only; confirmed delete optimistic
- **Web — Empty state (1)** [G6]: Empty timeline CTA
- **Web — Loading/Error (2)** [G6]: Loading indicator; error state
