# Users Tweets Specification (API)

## Purpose

Defines the per-user tweets listing endpoint: `GET /users/:username/tweets` returns a `CursorPage<PublicTweet>` of that user's tweets, using the exact pagination semantics already shipped for `GET /tweets/timeline`. Handler lives on `UsersController`; pagination logic is owned by `TweetsService`. New route — no prior spec exists. 6 scenarios total.

## Requirements

### Requirement: List a User's Tweets
The system MUST expose `GET /users/:username/tweets` returning that user's own tweets, newest-first, as a `CursorPage<PublicTweet>`, with limit/cursor semantics identical to `GET /tweets/timeline` (default `limit` of 20, `limit` bounded between 1 and 50, cursor is a tweet id, `nextCursor`/`hasMore` computed the same way).

#### Scenario: Returns only that user's tweets, newest-first
- GIVEN a target username with tweets, and other users with their own tweets
- WHEN `GET /users/:username/tweets` is called
- THEN the response `items` MUST contain only the target user's tweets, ordered newest-first, and MUST NOT include any other user's tweets

#### Scenario: CursorPage shape with working cursor pagination
- GIVEN a target username with more tweets than the requested `limit`
- WHEN `GET /users/:username/tweets` is called with that `limit`, and then called again with the returned `nextCursor`
- THEN each response MUST have the `CursorPage<PublicTweet>` shape (`items`, `nextCursor`, `hasMore`), the first page's `hasMore` MUST be `true`, and the second page MUST return the next set of tweets with no overlap with the first page

#### Scenario: Limit default and max semantics identical to timeline
- GIVEN a target username with tweets
- WHEN `GET /users/:username/tweets` is called with no `limit`, the system MUST default to 20 items per page; WHEN called with `limit=50`, the system MUST accept it; WHEN called with `limit=51`, the system MUST reject it with 400 — matching `TimelineQueryDto`'s bounds (`@Min(1)`, `@Max(50)`, default `20`) exactly

#### Scenario: Empty page for user with no tweets
- GIVEN a target username with zero tweets
- WHEN `GET /users/:username/tweets` is called
- THEN the system MUST return 200 with `items: []`, `nextCursor: null`, `hasMore: false`

#### Scenario: Unknown username rejected
- GIVEN a username with no matching account
- WHEN `GET /users/:username/tweets` is called
- THEN the system MUST return 404, resolved before any tweet query runs

#### Scenario: Unauthenticated tweets-list access rejected
- GIVEN no valid session cookie
- WHEN `GET /users/:username/tweets` is called
- THEN the system MUST return 401 (global guard, no `@Public()`)
