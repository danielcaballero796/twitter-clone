# Infra Specification

## Purpose

Defines the runnable, cross-platform monorepo skeleton (workspace layout, containerized Postgres, CI) that later feature changes build on. No feature behavior — only structure, wiring, and health verification.

## Requirements

### Requirement: Workspace Layout

The system MUST be organized as a pnpm workspace with `apps/api` (NestJS 11), `apps/web` (Vite + React 18 + Tailwind), and `packages/shared` (shared TS types).

#### Scenario: Fresh clone installs cleanly

- GIVEN a clean clone of the repo on Windows, Mac, or Linux
- WHEN a developer runs `pnpm install` at the root
- THEN all three workspace packages resolve and install without shell-specific errors

### Requirement: Containerized Postgres

The system MUST provide a `docker-compose.yml` that starts Postgres 16 with two databases: a dev DB and a separate `twitter_test` DB.

#### Scenario: Dev and test databases boot

- GIVEN Docker Desktop is running
- WHEN a developer runs `docker compose up -d`
- THEN both the dev and `twitter_test` Postgres databases become reachable on their configured ports

### Requirement: Environment Configuration Template

The system MUST ship a `.env.example` documenting every required environment variable (DB URLs, ports, secrets placeholders) with no real secrets committed.

#### Scenario: Developer bootstraps env from template

- GIVEN a fresh clone with no `.env` file
- WHEN a developer copies `.env.example` to `.env` and fills placeholders
- THEN the api app starts without missing-variable errors

### Requirement: Health Check and App Shell

The api app MUST expose a health-check endpoint, and the web app MUST render a minimal app shell, both with no feature logic.

#### Scenario: API health check responds

- GIVEN the api app is running against the dev database
- WHEN a client requests the health endpoint
- THEN the system returns a 200 response confirming API and DB connectivity

#### Scenario: Web shell renders

- GIVEN the web app is running
- WHEN a browser loads the root route
- THEN the app shell renders without runtime errors

### Requirement: Cross-Platform Scripts

All root and workspace npm scripts MUST run identically on Windows, Mac, and Linux without shell-specific syntax.

#### Scenario: Scripts run on evaluator machine

- GIVEN an evaluator on Mac or Linux (author develops on Windows)
- WHEN they run any documented root script (`pnpm test`, `pnpm build`, `pnpm lint`)
- THEN the script completes without OS-specific failures

### Requirement: Continuous Integration Pipeline

The system MUST run lint and test jobs via GitHub Actions on every push.

#### Scenario: CI runs green on push

- GIVEN a commit is pushed to the repository
- WHEN GitHub Actions triggers the workflow
- THEN lint and test jobs both complete successfully

#### Scenario: CI fails on broken code

- GIVEN a commit introduces a lint violation or failing test
- WHEN GitHub Actions triggers the workflow
- THEN the corresponding job MUST fail, blocking a green status
