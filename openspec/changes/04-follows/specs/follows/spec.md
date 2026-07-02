# Follows Specification (API)

## Purpose

Defines follow/unfollow edges and followers/following list retrieval. New domain — no prior spec exists.

## Requirements

### Requirement: Follow a User
The system MUST let an authenticated user follow another user by username, idempotently.

#### Scenario: Successful follow
- GIVEN an authenticated user and an existing target username they do not already follow
- WHEN `POST /users/:username/follow` is called
- THEN the system MUST create the follow edge and return 200/201

#### Scenario: Idempotent re-follow
- GIVEN an authenticated user already following the target username
- WHEN `POST /users/:username/follow` is called again
- THEN the system MUST return 200, no duplicate edge created, no error

#### Scenario: Self-follow rejected
- GIVEN an authenticated user
- WHEN `POST /users/:username/follow` is called with their own username
- THEN the system MUST return 400, no edge created

#### Scenario: Unknown target rejected
- GIVEN an authenticated user and a username with no matching account
- WHEN `POST /users/:username/follow` is called
- THEN the system MUST return 404

#### Scenario: Unauthenticated follow rejected
- GIVEN no valid session cookie
- WHEN `POST /users/:username/follow` is called
- THEN the system MUST return 401

### Requirement: Unfollow a User
The system MUST let an authenticated user remove a follow edge, idempotently.

#### Scenario: Successful unfollow
- GIVEN an authenticated user following the target username
- WHEN `DELETE /users/:username/follow` is called
- THEN the system MUST remove the edge and return 200

#### Scenario: Idempotent unfollow when not following
- GIVEN an authenticated user not following the target username
- WHEN `DELETE /users/:username/follow` is called
- THEN the system MUST return 200, no error

#### Scenario: Unknown target rejected
- GIVEN an authenticated user and a username with no matching account
- WHEN `DELETE /users/:username/follow` is called
- THEN the system MUST return 404

#### Scenario: Unauthenticated unfollow rejected
- GIVEN no valid session cookie
- WHEN `DELETE /users/:username/follow` is called
- THEN the system MUST return 401

### Requirement: Followers and Following Lists
The system MUST expose capped, non-paginated lists of a user's followers and followed users as `UserSummary[]`.

#### Scenario: Followers list returned
- GIVEN a target username with followers
- WHEN `GET /users/:username/followers` is called
- THEN the system MUST return 200 with `{ items: UserSummary[] }`

#### Scenario: Following list returned
- GIVEN a target username following others
- WHEN `GET /users/:username/following` is called
- THEN the system MUST return 200 with `{ items: UserSummary[] }`

#### Scenario: Limit capped at default and max
- GIVEN a target username with more than 50 followers
- WHEN `GET /users/:username/followers` is called with no `limit`
- THEN the system MUST return at most 50 items; a `limit` above 100 MUST be rejected with 400

#### Scenario: isFollowing in list items is relative to the session user
- GIVEN session user S views the followers list of user B, and S follows some of those followers
- WHEN `GET /users/B/followers` is called
- THEN each item's `isFollowing` MUST reflect whether S follows that user (not whether B does)

#### Scenario: Unknown username rejected
- GIVEN a username with no matching account
- WHEN `GET /users/:username/followers` or `/following` is called
- THEN the system MUST return 404

#### Scenario: Unauthenticated list access rejected
- GIVEN no valid session cookie
- WHEN `GET /users/:username/followers` or `/following` is called
- THEN the system MUST return 401

### Requirement: Timeline Reflects New Follows
The system MUST make a newly followed user's tweets appear in the session user's timeline without further changes to the timeline endpoint.

#### Scenario: Timeline includes newly followed user's tweets
- GIVEN the session user does not yet follow author B, and B has existing tweets
- WHEN the session user calls `POST /users/B/follow` and then `GET /tweets/timeline`
- THEN the response MUST include B's tweets alongside the session user's own
