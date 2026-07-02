# Users Profile Specification (API)

## Purpose

Defines the profile payload endpoint owned by `UsersModule`: `GET /users/:username` returns a `UserProfile` — user fields, social counts, and a session-relative `isFollowing` flag. New endpoint on an existing controller — no prior spec exists for this route. 8 scenarios total.

## Requirements

### Requirement: User Profile Payload
The system MUST expose `GET /users/:username` returning a `UserProfile` with `id`, `username`, `displayName`, `bio`, `avatarUrl`, `followersCount`, `followingCount`, `tweetsCount`, and session-relative `isFollowing`.

#### Scenario: Profile returned with all UserProfile fields
- GIVEN an authenticated session user S and an existing target username
- WHEN `GET /users/:username` is called
- THEN the system MUST return 200 with a body containing `id`, `username`, `displayName`, `bio`, `avatarUrl`, `followersCount`, `followingCount`, `tweetsCount`, and `isFollowing`

#### Scenario: Counts correct
- GIVEN a target user with a known number of followers, a known number of followed users, and a known number of tweets
- WHEN `GET /users/:username` is called
- THEN `followersCount`, `followingCount`, and `tweetsCount` MUST exactly match those known values, computed from `_count` with no denormalized drift

#### Scenario: isFollowing true when session user follows target
- GIVEN session user S follows target user B
- WHEN S calls `GET /users/B`
- THEN the response `isFollowing` MUST be `true`

#### Scenario: isFollowing false when not following
- GIVEN session user S does not follow target user B
- WHEN S calls `GET /users/B`
- THEN the response `isFollowing` MUST be `false`

#### Scenario: isFollowing false on own profile
- GIVEN session user S requests their own username
- WHEN S calls `GET /users/S`
- THEN the response `isFollowing` MUST be `false` (a user cannot follow themselves; no self-follow edge exists per the follows spec)

#### Scenario: Unknown username rejected
- GIVEN a username with no matching account
- WHEN `GET /users/:username` is called
- THEN the system MUST return 404, same error shape as the follows service

#### Scenario: Unauthenticated profile access rejected
- GIVEN no valid session cookie
- WHEN `GET /users/:username` is called
- THEN the system MUST return 401 (global guard, no `@Public()`)

### Requirement: Route Coexistence
The system MUST resolve `GET /users/:username` alongside the existing `GET /users?q=` search route and the existing `GET /users/:username/followers` and `GET /users/:username/following` routes without collision.

#### Scenario: Search, followers, following, and profile routes all resolve correctly
- GIVEN an authenticated session user and an existing target user with followers and following
- WHEN the session user calls `GET /users?q=<substring>`, `GET /users/:username/followers`, `GET /users/:username/following`, and `GET /users/:username` in sequence
- THEN each call MUST be routed to its own handler and return its own correct response — the profile route MUST NOT intercept search or follows-list requests, and vice versa
