# Data Model Specification

## Purpose

Defines the complete Prisma schema and migration for the core domain entities from day 1, so later feature changes (auth, tweets, follows, likes) implement behavior against a stable, already-migrated schema.

## Requirements

### Requirement: Complete Prisma Schema

The system MUST define a Prisma schema containing `User`, `Tweet`, `Follow`, and `Like` models before any feature change begins.

#### Scenario: Schema covers all core entities

- GIVEN the Prisma schema file
- WHEN it is inspected
- THEN it MUST declare `User`, `Tweet`, `Follow`, and `Like` models with their relations

### Requirement: Tweet Self-Referencing Replies

The `Tweet` model MUST support optional replies via a nullable `parentId` self-relation.

#### Scenario: Top-level tweet has no parent

- GIVEN a new tweet is created without a `parentId`
- WHEN it is persisted
- THEN `parentId` MUST be `null` and the tweet is treated as top-level

#### Scenario: Reply references a parent tweet

- GIVEN an existing tweet
- WHEN a reply is created with `parentId` set to that tweet's id
- THEN the reply MUST be persisted with a valid self-referencing relation to the parent

### Requirement: Uniqueness Constraints

`Follow` and `Like` MUST enforce unique constraints preventing duplicate relationships.

#### Scenario: Duplicate follow rejected

- GIVEN user A already follows user B
- WHEN a second identical `Follow` row (same follower/following pair) is attempted
- THEN the database MUST reject it via a unique constraint violation

#### Scenario: Duplicate like rejected

- GIVEN user A already liked tweet T
- WHEN a second identical `Like` row (same user/tweet pair) is attempted
- THEN the database MUST reject it via a unique constraint violation

### Requirement: Timeline Query Index

The system MUST define a composite index on `Tweet(authorId, createdAt)` to support efficient timeline queries.

#### Scenario: Index exists in migration

- GIVEN the generated Prisma migration
- WHEN it is inspected
- THEN it MUST include an index on `(authorId, createdAt)` for the `Tweet` table

### Requirement: Migration Applies Cleanly

The first Prisma migration MUST apply cleanly against a fresh Postgres 16 database with no manual intervention.

#### Scenario: Fresh database migrates successfully

- GIVEN an empty `twitter_test` Postgres 16 database
- WHEN `prisma migrate deploy` (or equivalent) runs
- THEN all tables, constraints, and indexes are created without error
