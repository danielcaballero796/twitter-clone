# Users Specification (API)

## Purpose

Defines user search behavior owned by `UsersModule`. New domain — no prior spec exists.

## Requirements

### Requirement: User Search
The system MUST expose `GET /users?q=` returning users whose username or displayName case-insensitively matches `q`, capped, excluding the session user, each carrying a server-computed `isFollowing`.

#### Scenario: Match by username
- GIVEN authenticated session user S and target user with username containing the query substring
- WHEN `GET /users?q=<substring>` is called
- THEN the system MUST return 200 with matching users as `UserSummary[]`

#### Scenario: Match by displayName
- GIVEN authenticated session user S and target user with displayName containing the query substring
- WHEN `GET /users?q=<substring>` is called
- THEN the system MUST return 200 with matching users as `UserSummary[]`

#### Scenario: Case-insensitive matching
- GIVEN a target user with username `JohnDoe`
- WHEN `GET /users?q=johndoe` is called
- THEN the system MUST include that user in the results

#### Scenario: Session user excluded from results
- GIVEN the session user's own username/displayName matches `q`
- WHEN `GET /users?q=<matching substring>` is called
- THEN the system MUST NOT include the session user in `items`

#### Scenario: Results capped
- GIVEN more than 10 users match `q`
- WHEN `GET /users?q=<substring>` is called
- THEN the system MUST return at most 10 items

#### Scenario: isFollowing computed per session user
- GIVEN the session user already follows a matching result user
- WHEN `GET /users?q=<substring>` is called
- THEN that result item's `isFollowing` MUST be `true`

#### Scenario: Missing or empty query rejected
- GIVEN no `q` param or an empty string
- WHEN `GET /users` is called
- THEN the system MUST return 400

#### Scenario: Unauthenticated search rejected
- GIVEN no valid session cookie
- WHEN `GET /users?q=<substring>` is called
- THEN the system MUST return 401
