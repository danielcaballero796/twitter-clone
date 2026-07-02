# Proposal: 07-seed — Deterministic Demo Seed Script

## Intent

Make the app demo-ready in one command: a deterministic seed script that populates the database with realistic users, a follow graph, tweets, and likes, so a reviewer can log in with documented credentials and immediately see a living timeline, profiles with counters, and like/follow state — the full 02–06 feature surface, no manual setup.

## Rubric mapping

Funcionalidad (25): reviewers can exercise every shipped feature instantly. Proceso (15): documented credentials + one-command setup in the README. Testing (25): the seed itself is tested (counts, credential validity, idempotency). Calidad (20): deterministic, guarded, no new runtime dependencies.

## Scope

### In Scope
- **Seed script** `apps/api/prisma/seed.ts`: exports `seed(prisma)` (testable) plus a CLI entry; wipes existing data (FK-safe order) and inserts a fixed dataset: 8 users, ~20 follow edges, ~45 top-level tweets with staggered `createdAt` (exercises cursor pagination past the default page of 20), ~60 likes with varied counts.
- **Wiring**: `db:seed` script + `prisma.seed` config in `apps/api/package.json`; root convenience script if the monorepo root exposes one for db tasks.
- **Safety**: refuses to run when `NODE_ENV === 'production'`.
- **Credentials**: all seeded users share one documented demo password, hashed once with the same `@node-rs/argon2` `hash()` the API uses — seeded users can really log in.
- **Docs**: README section — how to run the seed, demo usernames + password.
- **Tests**: Jest spec running `seed()` against the real test Postgres asserting entity counts, that a seeded user's `passwordHash` verifies against the demo password, and that running twice is idempotent (same counts, no constraint errors).

### Out of Scope
- Replies/threads in seed data (threads UI is a separate future change).
- Faker or any randomization library — dataset is static arrays.
- Seeding through HTTP endpoints (script talks Prisma directly; contracts already proven e2e in 02–06).

## Approach

Plain Prisma script, no framework bootstrapping: delete in FK-safe order, then `createMany` users/follows/tweets/likes from literal fixture arrays with deterministic timestamp offsets. Hash the shared password once, reuse for all 8 users. Export the core as `seed(prisma)` so the Jest spec imports it directly against the test DB (same pattern the e2e suite already uses). Strict TDD: spec RED first, then the script.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/prisma/seed.ts` | New | fixture data + `seed()` + CLI entry with production guard |
| `apps/api/package.json` | Modified | `db:seed` script, `prisma.seed` config |
| `apps/api/test/seed.e2e-spec.ts` | New | counts, login-hash validity, idempotency |
| `README.md` | Modified | seed instructions + demo credentials |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Seed wipes a database someone cares about | Low | production guard + README warning; challenge context is local/demo |
| Hashing 8 passwords slows seed/tests | Low | hash once, reuse — one argon2 call total |
| Dataset too small to show pagination | Low | ≥25 timeline-visible tweets for the main demo user (default page = 20) |

## Rollback Plan

Purely additive (one script + wiring + docs). Revert the commits; no schema or runtime code touched.

## Dependencies

- Schema and API contracts from changes 01–06 (final — no migration needed).
- `@node-rs/argon2` already a dependency of `apps/api`.

## Success Criteria

- [ ] `pnpm --filter @twitterclone/api db:seed` populates a fresh DB in one command.
- [ ] Logging in via the real API with a documented seeded user works, timeline shows multiple pages, profiles show non-zero follower/tweet/like counters.
- [ ] Seed spec green: counts, credential verification, run-twice idempotency.
- [ ] README documents seed usage + credentials; CI green.
