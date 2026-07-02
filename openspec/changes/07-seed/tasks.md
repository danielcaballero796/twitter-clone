# Tasks: 07-seed — Deterministic Demo Seed Script

## 0. Setup — commit: `chore(api): wire db:seed script and prisma seed config`
- [x] 0.1 Add `"db:seed": "ts-node prisma/seed.ts"` to `apps/api/package.json` `scripts`
- [x] 0.2 Add top-level `"prisma": { "seed": "ts-node prisma/seed.ts" }` to `apps/api/package.json` so `prisma db seed` / `migrate reset` hooks work
- [x] 0.3 Verify with `pnpm --filter @twitterclone/api run` that `db:seed` is listed (script not yet runnable — file doesn't exist until block 1)

## 1. Seed script (D1-D4) — commit: `feat(api): add deterministic demo seed script + tests`
- [x] 1.1 RED: `apps/api/test/seed.e2e-spec.ts` — import `seed` from `../prisma/seed`, run against the real test Postgres (reset tables in `afterEach` following the established `likes.e2e-spec.ts` pattern: `like.deleteMany()` → `follow.deleteMany()` → `tweet.deleteMany()` → `user.deleteMany()`). Assert:
  - `seed(prisma)` resolves `{ users: 8, follows: 20, tweets: 45, likes: 60 }`
  - DB row counts after seeding match those numbers exactly
  - fetch `ada`, `verify(ada.passwordHash, 'Flock123!')` (from `@node-rs/argon2`) resolves `true`
  - ada's timeline-visible tweet count (self + her 5 followees, via the same author-set query `TweetsService.timeline` uses) is `36` (>= 25)
  - every seeded tweet's `_count.likes` is between 0 and 6 inclusive
  - ada's first timeline page (limit 20) contains at least one tweet with `likedByMe: true` and one with `likedByMe: false`
  - running `seed(prisma)` a second time returns the same counts with no thrown constraint errors, and DB row counts stay at 8/20/45/60
  Run → failing (module doesn't exist)
- [x] 1.2 GREEN: `apps/api/prisma/seed.ts`:
  - Literal fixture arrays per pinned dataset: 8 users (`ada, linus, grace, margaret, alan, barbara, dennis, katherine`; emails `<username>@theflock.dev`; displayName + short bio), hash `'Flock123!'` ONCE via `@node-rs/argon2` `hash()`, reuse for all 8
  - 20 follow edges; ada → `[linus, grace, margaret, alan, barbara]` (5); every user has >=1 follower and >=1 following; no user follows everyone
  - 45 tweets: ada=7, linus=6, grace=6, margaret=6, alan=6, barbara=5, dennis=5, katherine=4; `createdAt` staggered deterministically (`BASE = now - 7d`, each tweet `BASE + i * 90min`), no `parentId`
  - 60 likes spread so per-tweet counts fall in 0-6, and ada's first 20 timeline tweets (by her seeded `createdAt` ordering) include both a liked and an unliked tweet
  - `async function seed(prisma: PrismaClient): Promise<SeedSummary>` — wipes in FK-safe order (`like` → `follow` → `tweet` → `user`), inserts fresh, returns `{ users, follows, tweets, likes }` counts from the insert results
  - CLI entry (`require.main === module`): guard `if (process.env.NODE_ENV === 'production')` → print refusal, `process.exit(1)`, no `PrismaClient` instantiation before the check; otherwise instantiate `PrismaClient`, call `seed()`, log summary, `$disconnect()`, non-zero exit on thrown error
  Run → green
- [x] 1.3 REFACTOR: rerun `apps/api` full suite green; confirm no duplicated wipe logic between the seed script and e2e reset hooks (comment cross-reference is enough, no shared import required)

## 2. Docs (D-none, README only) — commit: `docs: add demo seed instructions to README`
- [ ] 2.1 Add a "Demo data" section to root `README.md` (after "Testing", following existing table/code-block style) documenting: `pnpm --filter @twitterclone/api db:seed` command, the 8 seeded usernames, and the shared password `Flock123!`
- [ ] 2.2 Add one line noting the production guard (script refuses to run when `NODE_ENV=production`)

## 3. Final verification
- [ ] 3.1 `pnpm test` (all workspaces) green; api coverage >=85% (dto/module excluded, per existing jest config); `pnpm lint` clean; `pnpm format` clean (`pnpm format:write` then reverify if needed); `pnpm -r typecheck` clean; `pnpm build` green
- [ ] 3.2 Confirm commit granularity matches the 3 commits above (setup wiring / seed script+tests / docs) — no unrelated changes bundled in
- [ ] 3.3 Push; confirm CI green

## Scenario Coverage Checklist (9/9)
- **CLI Seeding (2)** [B1]: Fresh database seeded via CLI (counts + summary); `seed()` returns matching `SeedSummary` counts
- **Production Guard (1)** [B1]: Refused under `NODE_ENV=production`, exit 1, no writes
- **Wipe-Then-Insert Idempotency (1)** [B1]: Re-running the seed twice converges to identical counts, no constraint errors
- **Credential Validity (1)** [B1]: Seeded `ada` passwordHash verifies against `Flock123!` via `@node-rs/argon2`
- **Timeline Depth (1)** [B1]: ada's timeline-visible tweet count is 36 (>= 25), forcing pagination past the default limit of 20
- **Like Distribution (2)** [B1]: Per-tweet like counts fall within 0-6; ada's first timeline page mixes `likedByMe: true` and `false`
- **README Docs (1)** [B2]: Seed command + demo usernames + password documented

Counts: seed spec 9, verified by direct count against `specs/seed/spec.md` = **9**.
