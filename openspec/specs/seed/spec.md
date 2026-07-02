# Seed Specification (API)

## Purpose

Defines `apps/api/prisma/seed.ts`: a deterministic seed script (testable `seed(prisma)` core + CLI entry) that populates a fresh database with a fixed demo dataset — 8 users, 20 follow edges, 45 tweets, 60 likes — so a reviewer can log in and immediately exercise timeline pagination, follow state, and like counts. New domain — no prior spec exists. 9 scenarios total.

## Requirements

### Requirement: CLI Seeding Populates the Fixed Dataset
The system MUST let an operator run `pnpm --filter @twitterclone/api db:seed` to populate a fresh database with the fixed demo dataset and print a summary of counts.

#### Scenario: Fresh database seeded via CLI
- GIVEN an empty (or previously-seeded) database and `NODE_ENV` not `production`
- WHEN `pnpm --filter @twitterclone/api db:seed` is run
- THEN the system MUST insert exactly 8 users, 20 follow edges, 45 tweets, and 60 likes, and print a summary matching those counts

#### Scenario: seed() returns matching counts
- GIVEN the `seed(prisma)` function is called directly against a database
- WHEN it completes
- THEN it MUST return `{ users: 8, follows: 20, tweets: 45, likes: 60 }`

### Requirement: Production Guard
The system MUST refuse to run the CLI seed against a production environment and MUST NOT write any data in that case.

#### Scenario: Refused under NODE_ENV=production
- GIVEN `NODE_ENV=production`
- WHEN the seed CLI is invoked
- THEN the system MUST print a refusal message, exit with a non-zero code, and perform no deletes or inserts

### Requirement: Wipe-Then-Insert Idempotency
Running the seed twice in succession MUST converge to the identical dataset shape with no constraint errors.

#### Scenario: Re-running the seed is safe
- GIVEN a database already populated by a prior seed run
- WHEN `seed(prisma)` is run again
- THEN the system MUST wipe existing seed-owned data in FK-safe order (likes, follows, tweets, users) before inserting, MUST NOT raise any unique-constraint or foreign-key errors, and MUST return the same counts as the first run

### Requirement: Seeded Credentials Are Valid
Every seeded user MUST be able to authenticate through the real API auth path using one documented demo password.

#### Scenario: Password hash verifies for a seeded user
- GIVEN a seeded user (e.g. `ada`) fetched from the database after seeding
- WHEN `@node-rs/argon2`'s `verify(user.passwordHash, 'Flock123!')` is called (the same demo password documented in the README)
- THEN it MUST resolve to `true`

### Requirement: Demo User Timeline Depth Exercises Pagination
The designated demo user's (`ada`) timeline MUST contain enough visible tweets to force a second page at the default page size of 20.

#### Scenario: ada's timeline exceeds one page
- GIVEN the seeded dataset, where `ada` follows 5 other seeded users
- WHEN `ada`'s timeline (self + followees) is queried with the default page size of 20
- THEN the total count of timeline-visible tweets for `ada` MUST be at least 25 (actual dataset: 36), requiring at least 2 pages to view fully

### Requirement: Like Distribution Shows Both Liked and Unliked State
Seeded likes MUST be spread so counts vary across tweets and the demo user sees a mix of liked/unliked tweets on her first page.

#### Scenario: Like counts fall within the documented range
- GIVEN the 60 seeded likes spread across the 45 seeded tweets
- WHEN any seeded tweet's like count is inspected
- THEN it MUST be between 0 and 6 inclusive

#### Scenario: ada's first timeline page mixes liked and unliked tweets
- GIVEN the seeded dataset and `ada` authenticated
- WHEN `ada` fetches the first page (20 items) of her timeline
- THEN the page MUST contain at least one tweet with `likedByMe: true` and at least one tweet with `likedByMe: false`

### Requirement: Demo Data Documented in README
The README MUST document how to run the seed and which credentials to use.

#### Scenario: README covers seed usage
- GIVEN a reviewer reading the root README
- WHEN they reach the demo-data section
- THEN it MUST show the `pnpm --filter @twitterclone/api db:seed` command and list the seeded usernames with the shared demo password `Flock123!`
