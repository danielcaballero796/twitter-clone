# Design: 07-seed — Deterministic Demo Seed Script

## Binding decisions

### D1 — Location & wiring: `apps/api/prisma/seed.ts`, testable core + CLI entry

- File exports `async function seed(prisma: PrismaClient): Promise<SeedSummary>` where `SeedSummary = { users: number; follows: number; tweets: number; likes: number }` (returned from the insert counts — lets the spec and CLI report identically).
- CLI entry in the same file: when run directly (`require.main === module`), instantiate `PrismaClient`, run the production guard, call `seed()`, log the summary, `$disconnect()`, exit non-zero on failure.
- `apps/api/package.json`:
  - `"db:seed": "ts-node prisma/seed.ts"` under `scripts`.
  - `"prisma": { "seed": "ts-node prisma/seed.ts" }` top-level config so `prisma db seed` and `migrate reset` hooks work.
- No NestJS bootstrapping — plain Prisma, mirrors how e2e specs talk to the DB.

### D2 — Idempotency: wipe-then-insert, production guard

- Order: `like.deleteMany()` → `follow.deleteMany()` → `tweet.deleteMany()` → `user.deleteMany()` (explicit FK-safe order; don't rely on cascades).
- Then insert fresh. Re-running always converges to the identical dataset (modulo generated cuids). No upsert bookkeeping.
- Guard (CLI path only, not `seed()` itself so tests stay free): if `process.env.NODE_ENV === 'production'`, print refusal and exit 1.

### D3 — Dataset shape (static fixture arrays in the seed file)

- **8 users**: fixed usernames (`ada`, `linus`, `grace`, `margaret`, `alan`, `barbara`, `dennis`, `katherine` — or similar recognizable dev-culture names), matching emails `<username>@theflock.dev`, displayNames, short bios. All share password `Flock123!` hashed ONCE with `hash()` from `@node-rs/argon2` (identical call to `UsersService.create`) and reused for every row.
- **Follow graph ~20 edges**: `ada` is the designated demo user — she follows 5 users; every user has ≥1 follower and ≥1 following; no user follows everyone (so follow buttons still have something to do in the demo).
- **~45 tweets**: distributed so that ada's timeline (self + her 5 followees) contains **≥25 tweets** — forces a second page at the default `limit = 20` and proves cursor pagination in the demo. `createdAt` staggered deterministically (e.g. `BASE = now - 7d`, each tweet `BASE + i * 90min`) so ordering is stable and human-plausible.
- **~60 likes**: spread so counts range 0–6 across tweets, and the demo user has both liked-by-me and not-liked tweets visible on her first timeline page.

### D4 — Determinism: no dependencies, no randomness

- No faker, no `Math.random()`. Content is literal strings; timestamps are computed offsets from a single base. The only nondeterminism is generated cuids and the base timestamp.

### D5 — Testing (strict TDD): `apps/api/test/seed.e2e-spec.ts`

- Imports `seed` directly, runs against the same test Postgres the e2e suite uses.
- RED-first assertions:
  1. Counts match `SeedSummary` and the D3 spec (8 users, expected follow/tweet/like totals).
  2. Credential validity: fetch `ada`, `verify(passwordHash, 'Flock123!')` from `@node-rs/argon2` is true — proves seeded users can log in through the real auth path.
  3. Timeline depth: ada's timeline-visible tweet count ≥ 25 (query via Prisma with the same author-set logic).
  4. Idempotency: run `seed()` twice → same counts, no unique-constraint errors.
- Existing suites already truncate tables per test file; seed spec must reset after itself the same way the other e2e specs do (follow the established pattern in `apps/api/test`).

## Non-goals

- Replies (`parentId` stays null everywhere), notifications, media.
- Seeding via HTTP.

## Open points for tasks phase

- Verify root `README.md` structure to place the "Demo data" section (root README owns run instructions today).
- Check whether root `package.json` has a db-scripts convention worth extending (nice-to-have, not required).
