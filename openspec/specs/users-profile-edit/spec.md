# Users Profile Edit Specification (API)

## Purpose

Defines profile self-editing owned by `UsersModule`: `PATCH /users/me` updates `displayName`, `bio`, and `avatarStyle` for the session user, plus the avatar-style model that derives every `avatarUrl` in the API. 10 scenarios total.

## Requirements

### Requirement: Profile Update Endpoint

The system MUST expose `PATCH /users/me` accepting any subset of `displayName`, `bio`, `avatarStyle` and returning the updated `PublicUser` (including `avatarStyle` and the recomputed `avatarUrl`).

#### Scenario: Display name updated
- GIVEN an authenticated session user
- WHEN `PATCH /users/me` is called with `{ displayName: "New Name" }`
- THEN the system MUST return 200 with `displayName: "New Name"` and leave `bio` and `avatarStyle` unchanged

#### Scenario: Bio updated
- GIVEN an authenticated session user
- WHEN `PATCH /users/me` is called with `{ bio: "Hello there" }`
- THEN the system MUST return 200 with `bio: "Hello there"` and the change MUST be visible on `GET /users/:username`

#### Scenario: Empty bio clears to null
- GIVEN an authenticated session user with a non-null bio
- WHEN `PATCH /users/me` is called with `{ bio: "" }`
- THEN the stored bio MUST become `null` and the response MUST carry `bio: null`

#### Scenario: Avatar style updated
- GIVEN an authenticated session user with the default style
- WHEN `PATCH /users/me` is called with `{ avatarStyle: "bottts" }`
- THEN the response `avatarStyle` MUST be `"bottts"` and `avatarUrl` MUST point at the `bottts` collection still seeded by the username

#### Scenario: Empty patch is a no-op
- GIVEN an authenticated session user
- WHEN `PATCH /users/me` is called with `{}`
- THEN the system MUST return 200 with the unchanged `PublicUser`

### Requirement: Update Validation

The system MUST validate updates with the same bounds as registration: `displayName` 1–50 chars, `bio` at most 160 chars, `avatarStyle` a member of the shared `AVATAR_STYLES` whitelist.

#### Scenario: Invalid avatar style rejected
- GIVEN an authenticated session user
- WHEN `PATCH /users/me` is called with `{ avatarStyle: "not-a-style" }`
- THEN the system MUST return 400 and store nothing

#### Scenario: Out-of-bounds fields rejected
- GIVEN an authenticated session user
- WHEN `PATCH /users/me` is called with an empty `displayName`, a `displayName` longer than 50 chars, or a `bio` longer than 160 chars
- THEN the system MUST return 400 and store nothing

#### Scenario: Unauthenticated update rejected
- GIVEN no valid session cookie
- WHEN `PATCH /users/me` is called
- THEN the system MUST return 401 (global guard, no `@Public()`)

### Requirement: Avatar Style Propagation

Every `avatarUrl` the API emits MUST be derived from the owner's stored `avatarStyle` and username seed — profiles, session payloads, tweet authors, and user summaries alike.

#### Scenario: Changed style visible everywhere
- GIVEN user B changed `avatarStyle` to a non-default style and has tweets and followers
- WHEN another user fetches `GET /users/B`, `GET /users?q=B`, and a timeline containing B's tweets
- THEN every returned `avatarUrl` for B MUST use the non-default collection with B's username as seed

#### Scenario: Existing users keep their identicon
- GIVEN a user created before this change (no explicit style ever set)
- WHEN any payload containing that user is fetched
- THEN their `avatarUrl` MUST be the same identicon URL as before the migration
