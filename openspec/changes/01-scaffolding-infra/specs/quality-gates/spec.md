# Quality Gates Specification

## Purpose

Defines the test, coverage, lint, type-check, and formatting infrastructure that must be installed and PROVEN (via smoke tests) before any feature change relies on TDD. This unlocks `strict_tdd` for change 02 onward.

## Requirements

### Requirement: Backend Test Runner Proven

The api app MUST have Jest + Supertest installed and configured against a real Postgres test database, proven by at least one passing smoke test.

#### Scenario: API smoke test passes against real test DB

- GIVEN the `twitter_test` Postgres database is running
- WHEN `pnpm test` runs in `apps/api`
- THEN Jest MUST execute Supertest requests against the app and the smoke test MUST pass

### Requirement: Frontend Test Runner Proven

The web app MUST have Vitest + Testing Library installed, proven by at least one passing smoke test.

#### Scenario: Web smoke test passes

- GIVEN the web app's test setup
- WHEN `pnpm test` runs in `apps/web`
- THEN Vitest MUST execute the smoke test and it MUST pass

### Requirement: Coverage Gate

The api test suite MUST enforce a minimum coverage threshold of 85%, failing the run if unmet.

#### Scenario: Coverage below threshold fails the run

- GIVEN the api coverage configuration sets an 85% gate
- WHEN test coverage falls below 85% on any tracked metric
- THEN the test run MUST exit with a non-zero status

#### Scenario: Scaffolding-only code meets the gate

- GIVEN only scaffolding code (health check, app shell) exists with no feature logic
- WHEN coverage is measured
- THEN the coverage configuration MUST scope measurement to real source so the gate is meetable without artificial padding

### Requirement: Lint, Type-Check, and Format

The system MUST enforce ESLint, `tsc --noEmit`, and Prettier checks across all workspaces.

#### Scenario: Clean codebase passes all checks

- GIVEN the scaffolding codebase with no feature code
- WHEN `pnpm lint`, `tsc --noEmit`, and `pnpm format --check` run
- THEN all three MUST complete with zero errors

#### Scenario: Violation blocks the gate

- GIVEN a file with a lint violation or type error is introduced
- WHEN the corresponding check runs
- THEN it MUST fail with a non-zero exit code

### Requirement: TDD Mode Activation Readiness

Once test runners are installed and smoke-tested, the project configuration SHOULD be updated to reflect `strict_tdd: true` and `test_runner` as detected, enabling TDD enforcement starting with change 02.

#### Scenario: Config reflects installed runners after scaffolding

- GIVEN Jest and Vitest are installed and their smoke tests pass
- WHEN `openspec/config.yaml` testing block is re-evaluated
- THEN it SHOULD report `test_runner` as found and layers as installed, no longer `not_found`/`not_installed`
