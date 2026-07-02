# Web Profile Specification (Frontend)

## Purpose

Defines frontend UX for the user profile page on a new protected `/u/:username` route: header with identity/counts, the user's tweets, follow/unfollow with optimistic count updates, and navigation into the route from `UserCard` (explore) and `TweetCard` (timeline/profile author). New domain — no prior spec exists. 13 scenarios total.

## Requirements

### Requirement: Profile Route Navigation
The system MUST provide a protected `/u/:username` route, mirroring the existing `/explore` protection pattern.

#### Scenario: Profile route protected
- GIVEN no authenticated session
- WHEN the user navigates to `/u/:username`
- THEN the system MUST redirect to the login flow (same behavior as other protected routes)

### Requirement: Profile Header
The system MUST render a profile header showing the target user's avatar, display name, `@username`, bio (when present), and the three counts (`followersCount`, `followingCount`, `tweetsCount`).

#### Scenario: Header renders identity and counts, with bio present
- GIVEN a profile response for a target user with a non-null `bio`
- WHEN `ProfilePage` renders
- THEN the system MUST display the avatar, display name, `@username`, the bio text, and all three counts

#### Scenario: Header renders without bio when absent
- GIVEN a profile response for a target user with `bio: null`
- WHEN `ProfilePage` renders
- THEN the system MUST display the avatar, display name, `@username`, and all three counts, and MUST NOT render an empty or placeholder bio element in its place

### Requirement: Profile Tweets Feed
The system MUST render the target user's tweets below the header, reusing the existing `TweetCard` component.

#### Scenario: User's tweets rendered via TweetCard
- GIVEN a profile response and a non-empty user-tweets page for the target user
- WHEN `ProfilePage` renders
- THEN each tweet in the user-tweets page MUST be rendered using `TweetCard`, in the order returned by the API

### Requirement: Profile Loading, Error, and Not-Found States
The system MUST distinguish loading, error, and not-found states for the profile query, matching the pattern already established on `ExplorePage`.

#### Scenario: Loading state
- GIVEN the profile (and/or user-tweets) request is in flight
- WHEN `ProfilePage` renders
- THEN the system MUST display a loading indicator instead of stale or empty content

#### Scenario: Error state
- GIVEN the profile request fails with a non-404 error
- WHEN `ProfilePage` renders
- THEN the system MUST display an error state, not a silent blank page

#### Scenario: Not-found state on 404
- GIVEN the profile request resolves with a 404 (unknown username)
- WHEN `ProfilePage` renders
- THEN the system MUST display a "user not found" state, distinct from the generic error state

### Requirement: Follow/Unfollow Optimistic Toggle with Count Update
The system MUST let the user follow or unfollow the profile's target user with immediate visual feedback on both the button state and `followersCount`, rolled back on failure. This reuses `useToggleFollow`, extended to also flip the profile cache — not a second mutation hook.

#### Scenario: Follow button flips optimistically and followersCount increments
- GIVEN `ProfilePage` for a not-yet-followed target user, showing "Follow" and a known `followersCount`
- WHEN the user clicks the follow button
- THEN the system MUST immediately flip the button to "Following" and increment the displayed `followersCount` by 1, before the server responds

#### Scenario: Unfollow button flips optimistically and followersCount decrements
- GIVEN `ProfilePage` for an already-followed target user, showing "Following" and a known `followersCount`
- WHEN the user clicks the unfollow button
- THEN the system MUST immediately flip the button to "Follow" and decrement the displayed `followersCount` by 1, before the server responds

#### Scenario: Rollback and error surfaced on mutation failure
- GIVEN an optimistic follow/unfollow toggle in flight on `ProfilePage`
- WHEN the server request fails
- THEN the system MUST revert both the button state and `followersCount` to their prior values and surface an error

### Requirement: No Follow Button on Own Profile
The system MUST NOT render a follow/unfollow button when the session user views their own profile.

#### Scenario: Own profile shows no follow button
- GIVEN the session user (from `useSession`) navigates to `/u/:ownUsername`
- WHEN `ProfilePage` renders
- THEN the system MUST NOT render a follow or unfollow button, determined by comparing `session.username === profile.username` (no `isSelf` field from the API)

### Requirement: Navigation Into Profiles
The system MUST make `UserCard` (explore results) and `TweetCard` (author) clickable links into the corresponding profile route, without breaking existing structure or test ids.

#### Scenario: UserCard in explore navigates to profile
- GIVEN a rendered `UserCard` for a user with a given username, on the `/explore` page
- WHEN the user clicks the user's display-name block
- THEN the system MUST navigate to `/u/:username`

#### Scenario: TweetCard author navigates to profile
- GIVEN a rendered `TweetCard` for a tweet with a given author username
- WHEN the user clicks the author's name/handle
- THEN the system MUST navigate to `/u/:username`, with the existing `data-testid`s and surrounding structure of `TweetCard` unchanged
