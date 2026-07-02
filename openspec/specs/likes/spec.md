# Likes Specification (API)

## Purpose

Defines the like/unlike edge mutations: `POST /tweets/:tweetId/like` and `DELETE /tweets/:tweetId/like`. New `LikesModule` mirroring `FollowsModule` — edge mutations only, idempotent both ways. New domain — no prior spec exists. 8 scenarios total.

## Requirements

### Requirement: Like a Tweet
The system MUST let an authenticated user like an existing tweet by id, idempotently.

#### Scenario: Successful like
- GIVEN an authenticated user and an existing tweet they have not already liked
- WHEN `POST /tweets/:tweetId/like` is called
- THEN the system MUST create the like edge and return 200

#### Scenario: Idempotent re-like
- GIVEN an authenticated user who already likes the target tweet
- WHEN `POST /tweets/:tweetId/like` is called again
- THEN the system MUST return 200, no duplicate edge created, no error

#### Scenario: Unknown tweet rejected on like
- GIVEN an authenticated user and a tweet id with no matching tweet
- WHEN `POST /tweets/:tweetId/like` is called
- THEN the system MUST return 404

#### Scenario: Unauthenticated like rejected
- GIVEN no valid session cookie
- WHEN `POST /tweets/:tweetId/like` is called
- THEN the system MUST return 401

### Requirement: Unlike a Tweet
The system MUST let an authenticated user remove a like edge, idempotently.

#### Scenario: Successful unlike
- GIVEN an authenticated user who likes the target tweet
- WHEN `DELETE /tweets/:tweetId/like` is called
- THEN the system MUST remove the edge and return 200

#### Scenario: Idempotent unlike when not liked
- GIVEN an authenticated user who does not like the target tweet
- WHEN `DELETE /tweets/:tweetId/like` is called
- THEN the system MUST return 200, no error

#### Scenario: Unknown tweet rejected on unlike
- GIVEN an authenticated user and a tweet id with no matching tweet
- WHEN `DELETE /tweets/:tweetId/like` is called
- THEN the system MUST return 404

#### Scenario: Unauthenticated unlike rejected
- GIVEN no valid session cookie
- WHEN `DELETE /tweets/:tweetId/like` is called
- THEN the system MUST return 401
