# Tasks: 04-follows — Follow/Unfollow + User Search

## 0. Setup
- [ ] 0.1 Add shared types to `packages/shared/src/index.ts`: `UserSummary { id, username, displayName, avatarUrl, isFollowing }`, `UserListResponse { items: UserSummary[] }`

## 1. Follow / Unfollow (idempotent) — commit: `feat(api): add follow/unfollow with idempotency + tests`
- [ ] 1.1 RED: `follows.service.spec.ts` — follow creates edge (author=sub); idempotent re-follow (no duplicate, no error); self-follow 400; unknown username 404; unfollow removes edge; idempotent unfollow-when-not-following (200, no error); unfollow unknown username 404. Run → failing
- [ ] 1.2 GREEN: `apps/api/src/follows/{follows.module,follows.service,follows.controller}.ts` — `follow()`/`unfollow()` via `createMany({skipDuplicates:true})`/`deleteMany`, resolve username→id first (404), self-check (400); `POST`/`DELETE /users/:username/follow`
- [ ] 1.3 REFACTOR: rerun green

## 2. Followers/Following lists + isFollowing — commit: `feat(api): add followers/following lists with limit cap + tests`
- [ ] 2.1 RED: extend `follows.service.spec.ts` — followers list returns `UserSummary[]`; following list returns `UserSummary[]`; default limit 50, `limit>100` rejected 400; `isFollowing` per item reflects session user S's graph (not target's); unknown username 404. Run → failing
- [ ] 2.2 GREEN: `apps/api/src/follows/dto/list-query.dto.ts` (`limit` `@Type(Number) @IsInt @Min(1) @Max(100)` default 50); `follows.service.ts` `followers()`/`following()` + `toUserSummary` mapper (batched isFollowing query, reuse `avatarUrlFor`); `follows.controller.ts` `GET /users/:username/{followers,following}`
- [ ] 2.3 REFACTOR: rerun green, `pnpm --filter api test --coverage` ≥85% for `follows/**`

## 3. User search API — commit: `feat(api): add user search endpoint with isFollowing + tests`
- [ ] 3.1 RED: `users.service.spec.ts` + `users.controller.spec.ts` — match by username substring; match by displayName substring; case-insensitive match; session user excluded from results; capped at 10; `isFollowing` true for already-followed match; empty/missing `q` → 400 (ValidationPipe); unauthenticated → 401. Run → failing
- [ ] 3.2 GREEN: `apps/api/src/users/dto/search-users.dto.ts` (`q` `@IsString @Length(1,50)`); `users.service.ts` `search(sub, q)` — `findMany({OR:[username contains, displayName contains], NOT:{id:sub}, take:10})` + batched `follow.findMany` → Set; `users.controller.ts` `GET /users?q=` (module's first controller); register in `users.module.ts`
- [ ] 3.3 REFACTOR: rerun green

## 4. E2E — real follow→timeline flow — commit: `test(api): add follows e2e flow with timeline integration`
- [ ] 4.1 RED: `apps/api/test/follows.e2e-spec.ts` — register A+B → A calls `POST /users/B/follow` → `GET /tweets/timeline` includes B's tweets (mandatory, no seeding hack); `DELETE /users/B/follow` → B's tweets gone from timeline; idempotent double-follow (no duplicate); self-follow 400; unknown username 404; unauthenticated follow/unfollow/list/search → 401. Run → failing
- [ ] 4.2 GREEN: register `FollowsModule` in `apps/api/src/app.module.ts`; fix any gaps surfaced by e2e
- [ ] 4.3 REFACTOR: all e2e suites green (auth + tweets + follows + health)

## 5. Web users API + hooks — commit: `feat(web): add users api client and search/follow hooks`
- [ ] 5.1 Add stateful `apps/web/src/test/msw/handlers.ts` handlers for `GET /users?q=`, `POST/DELETE /users/:username/follow` (mutate in-memory fixture so refetches reflect the change)
- [ ] 5.2 `apps/web/src/features/users/{api.ts,useSearchUsers.ts,useToggleFollow.ts}` — `useQuery` for search (debounce input upstream in component), single `useToggleFollow({username, isFollowing})` mutation with optimistic cache flip across cached search results + rollback on error + invalidate search and `TIMELINE_QUERY_KEY` on settled

## 6. Web /explore UI + mandatory follow-flow test — commit: `feat(web): add explore page with search, follow toggle and tests`
- [ ] 6.1 RED: `SearchBox.test.tsx` — fires search after debounce interval, not per keystroke. `UserCard.test.tsx`/`ExplorePage.test.tsx` — loading indicator while in flight; empty-state message on zero results; error state on search failure; follow button flips to "Following" optimistically; unfollow button flips to "Follow" optimistically; rollback + error surfaced on mutation failure; `/explore` redirects to login when unauthenticated. Run → failing
- [ ] 6.2 RED (mandatory): `ExplorePage.test.tsx` (or dedicated `follow-flow.test.tsx`) — full flow: search for target user → click follow → button flips → timeline refetch → target's tweets appear. Run → failing
- [ ] 6.3 GREEN: `apps/web/src/features/users/{SearchBox,UserCard,ExplorePage}.tsx`; `apps/web/src/App.tsx` add `/explore` under `ProtectedRoute`; `apps/web/src/features/auth/HomePage.tsx` add header nav `Link` to `/explore` only (no structural change, preserve existing `data-testid`s)
- [ ] 6.4 REFACTOR: web suite green, typecheck clean

## 7. Final verification
- [ ] 7.1 `pnpm test` + `pnpm build` (all workspaces) green; api coverage ≥85% (dto/module excluded); `pnpm lint` clean; `pnpm format --check` clean (Prettier miss cost change 03 a red CI run — do not skip); `pnpm -r typecheck` clean
- [ ] 7.2 Push; confirm CI green

## Scenario Coverage Checklist (34/34)
- **Follows API — Follow (5)** [G1]: Successful follow; idempotent re-follow; self-follow rejected; unknown target rejected; unauthenticated rejected
- **Follows API — Unfollow (4)** [G2]: Successful unfollow; idempotent unfollow-when-not-following; unknown target rejected; unauthenticated rejected
- **Follows API — Lists (6)** [G3]: Followers list returned; following list returned; limit capped (default+max); isFollowing relative to session user; unknown username rejected; unauthenticated rejected
- **Follows API — Timeline reflects follow (1)** [G4]: Newly followed user's tweets appear in timeline
- **Users API — Search (8)** [G5]: Match by username; match by displayName; case-insensitive; session user excluded; results capped at 10; isFollowing computed per session user; missing/empty query rejected (400); unauthenticated rejected
- **Web — Explore route (2)** [G6]: Nav entry visible on Home; explore route protected (redirect when unauthenticated)
- **Web — Debounced search (4)** [G6]: Search fires after debounce; loading indicator while in flight; empty results state; error state on search failure
- **Web — Follow toggle (3)** [G6]: Follow button flips optimistically; unfollow button flips optimistically; rollback + error on failure
- **Web — Mandatory follow flow (1)** [G6]: Search → follow → timeline reflects it

Note: proposal.md estimated 16+8+11=35 scenarios; the amended `specs/web-users/spec.md` has 10 (not 11) scenarios — actual total is **34**, verified by direct count against the three spec files.
