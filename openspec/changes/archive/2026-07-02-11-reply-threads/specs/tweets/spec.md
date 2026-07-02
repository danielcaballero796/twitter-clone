# Tweets Specification (API) — Reply Threads Delta

## Purpose

Extends tweet creation and retrieval with the reply relation: `POST /tweets` accepts an optional `parentId` to create a reply; every `PublicTweet` carries `replyCount` and `inReplyTo`; `GET /tweets/:id` and `GET /tweets/:id/replies` expose a single tweet and its thread. Replies are ordinary tweets — they appear in the timeline and profile lists unfiltered. 16 scenarios total.

## Requirements

### Requirement: Reply Creation via POST /tweets
The system MUST accept an optional `parentId` on `POST /tweets`, validating that the parent exists before creating the reply.

#### Scenario: Successful reply creation
- GIVEN an authenticated user and a valid `parentId` referencing an existing tweet
- WHEN `POST /tweets` is called with content and that `parentId`
- THEN the system MUST return 201 with the public tweet shape, `inReplyTo` populated with the parent's id and author username

#### Scenario: Unknown parentId rejected
- GIVEN an authenticated user and a `parentId` that does not match any existing tweet
- WHEN `POST /tweets` is called with that `parentId`
- THEN the system MUST return 404, no tweet created

#### Scenario: Omitted parentId behaves as a top-level tweet
- GIVEN an authenticated user and content with no `parentId`
- WHEN `POST /tweets` is called
- THEN the system MUST return 201 exactly as before this change, with `inReplyTo: null`

### Requirement: Reply Count on Every Tweet
The system MUST include an accurate `replyCount` on every `PublicTweet` returned by any tweet-listing or tweet-retrieval endpoint.

#### Scenario: replyCount reflects direct replies
- GIVEN a tweet with two direct replies
- WHEN any endpoint returns that tweet in a `PublicTweet` payload
- THEN its `replyCount` MUST equal 2

#### Scenario: New tweet starts with zero replyCount
- GIVEN an authenticated user creates a new tweet
- WHEN the creation response is returned
- THEN the tweet MUST include `replyCount: 0`

### Requirement: inReplyTo Marks Reply Provenance
The system MUST populate `inReplyTo` with the parent's id and author username on every `PublicTweet` that is a reply, and MUST return `null` for top-level tweets.

#### Scenario: Reply carries inReplyTo
- GIVEN a tweet B created as a reply to tweet A authored by user "ada"
- WHEN B is returned in any `PublicTweet` payload
- THEN `inReplyTo` MUST equal `{ id: A.id, username: "ada" }`

#### Scenario: Top-level tweet has null inReplyTo
- GIVEN a tweet created without a `parentId`
- WHEN it is returned in any `PublicTweet` payload
- THEN `inReplyTo` MUST be `null`

### Requirement: Single Tweet Retrieval
The system MUST expose `GET /tweets/:id` returning a single `PublicTweet`, 404 if no tweet matches, with session-relative `likedByMe`.

#### Scenario: Fetch existing tweet by id
- GIVEN a tweet exists with id X
- WHEN `GET /tweets/:id` is called with X
- THEN the system MUST return 200 with X's public tweet shape, `likedByMe` computed relative to the session user

#### Scenario: Fetch nonexistent tweet
- GIVEN no tweet exists with id X
- WHEN `GET /tweets/:id` is called with X
- THEN the system MUST return 404

### Requirement: Thread Replies Retrieval
The system MUST expose `GET /tweets/:id/replies` returning a cursor-paginated, oldest-first page of the tweet's direct replies.

#### Scenario: Replies returned oldest-first
- GIVEN a tweet with three direct replies created in sequence
- WHEN `GET /tweets/:id/replies` is called with that tweet's id
- THEN the system MUST return the replies ordered `createdAt asc, id asc`

#### Scenario: Empty replies page for a tweet with no replies
- GIVEN a tweet with no replies
- WHEN `GET /tweets/:id/replies` is called
- THEN the system MUST return 200 with an empty `items` array and `hasMore=false`

#### Scenario: Replies pagination follows cursor semantics
- GIVEN more replies exist than `limit`
- WHEN `GET /tweets/:id/replies?limit=N` is called with no cursor, followed by a call with the returned `nextCursor`
- THEN the first call MUST return N items with `hasMore=true` and a `nextCursor`, and the second call MUST return the next items with no overlap/gap versus the first page

#### Scenario: Invalid cursor rejected
- GIVEN a cursor value that does not correspond to an existing tweet id
- WHEN `GET /tweets/:id/replies?cursor=<invalid>` is called
- THEN the system MUST return 400, mirroring the timeline's invalid-cursor behavior

### Requirement: Replies Appear in Timeline and Profile Lists
The system MUST NOT filter replies out of `GET /tweets/timeline` or `GET /users/:username/tweets`; a reply is an ordinary tweet in those lists.

#### Scenario: Reply appears in the timeline unfiltered
- GIVEN the session user follows author A, and A posts a reply to another tweet
- WHEN `GET /tweets/timeline` is called
- THEN A's reply MUST appear in `items` in its chronological position, carrying its `inReplyTo`

### Requirement: Cascade Delete Removes the Reply Subtree
The system MUST delete all direct and transitive replies when their parent tweet is deleted, per the existing schema cascade.

#### Scenario: Deleting a parent removes its replies
- GIVEN a tweet with one or more replies
- WHEN the owning user deletes that tweet via `DELETE /tweets/:id`
- THEN the tweet and all of its replies MUST no longer be retrievable by id or in any listing

### Requirement: parentId Validation Shape
The system MUST reject a `parentId` that is not a validly-shaped id before attempting a database lookup.

#### Scenario: Malformed parentId rejected
- GIVEN an authenticated user and a `parentId` value that is not a valid id shape (e.g. empty string)
- WHEN `POST /tweets` is called with that `parentId`
- THEN the system MUST return 400, no tweet created
