# Tweets Specification (API)

## Purpose

Defines backend tweet CRUD and timeline behavior: create, delete, and reverse-chronological timeline retrieval with cursor pagination. New domain — no prior spec exists.

## Requirements

### Requirement: Tweet Creation
The system MUST create a tweet authored by the authenticated session user when content is 1–280 characters.

#### Scenario: Successful creation
- GIVEN an authenticated user and content of 1–280 chars
- WHEN `POST /tweets` is called
- THEN the system MUST return 201 with the public tweet shape, `authorId` = session user id

#### Scenario: Content at 280-char boundary accepted
- GIVEN an authenticated user and content of exactly 280 chars
- WHEN `POST /tweets` is called
- THEN the system MUST return 201 and persist the tweet

#### Scenario: Empty content rejected
- GIVEN an authenticated user and empty/whitespace-only content
- WHEN `POST /tweets` is called
- THEN the system MUST return 400, no tweet created

#### Scenario: Over-limit content rejected
- GIVEN an authenticated user and content of 281+ chars
- WHEN `POST /tweets` is called
- THEN the system MUST return 400, no tweet created

#### Scenario: Unauthenticated creation rejected
- GIVEN no valid session cookie
- WHEN `POST /tweets` is called
- THEN the system MUST return 401, no tweet created

### Requirement: Tweet Deletion
The system MUST allow only the authoring user to delete their own tweet.

#### Scenario: Owner deletes own tweet
- GIVEN an authenticated user who authored tweet X
- WHEN `DELETE /tweets/:id` is called with X's id
- THEN the system MUST delete the tweet and return 200/204

#### Scenario: Non-owner delete rejected
- GIVEN an authenticated user who did not author tweet X
- WHEN `DELETE /tweets/:id` is called with X's id
- THEN the system MUST return 403, tweet not deleted

#### Scenario: Delete nonexistent tweet
- GIVEN an authenticated user and an id with no matching tweet
- WHEN `DELETE /tweets/:id` is called
- THEN the system MUST return 404

#### Scenario: Unauthenticated delete rejected
- GIVEN no valid session cookie
- WHEN `DELETE /tweets/:id` is called
- THEN the system MUST return 401

### Requirement: Timeline Retrieval
The system MUST expose `GET /tweets/timeline` returning followed users' + own tweets ordered `createdAt desc, id desc`, with cursor pagination.

#### Scenario: Followed and own tweets in chronological order
- GIVEN the session user follows author A and has own tweets
- WHEN `GET /tweets/timeline` is called
- THEN the system MUST return only A's and the session user's tweets, ordered `createdAt desc, id desc`

#### Scenario: First page pagination
- GIVEN more tweets exist than `limit`
- WHEN `GET /tweets/timeline?limit=N` is called with no cursor
- THEN the system MUST return N items, `hasMore=true`, and a `nextCursor`

#### Scenario: Next page continues correctly
- GIVEN a valid `nextCursor` from a prior page
- WHEN `GET /tweets/timeline?cursor=<nextCursor>&limit=N` is called
- THEN the system MUST return the next N items with no overlap/gap versus the previous page

#### Scenario: Last page has no further cursor
- GIVEN the cursor points to the final page of results
- WHEN `GET /tweets/timeline?cursor=<cursor>` is called
- THEN the system MUST return the remaining items with `hasMore=false` and no `nextCursor`

#### Scenario: Invalid cursor rejected
- GIVEN a cursor value that does not correspond to an existing tweet id
- WHEN `GET /tweets/timeline?cursor=<invalid>` is called
- THEN the system MUST return 400

#### Scenario: Empty timeline
- GIVEN the session user follows no one and has no tweets
- WHEN `GET /tweets/timeline` is called
- THEN the system MUST return 200 with an empty items array, `hasMore=false`

#### Scenario: Unauthenticated timeline rejected
- GIVEN no valid session cookie
- WHEN `GET /tweets/timeline` is called
- THEN the system MUST return 401
