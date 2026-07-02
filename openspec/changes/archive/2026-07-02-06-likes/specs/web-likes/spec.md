# Web Likes Specification (Frontend)

## Purpose

Defines frontend UX for liking/unliking a tweet from `TweetCard`: a like button with visible count, optimistic toggle via `useToggleLike` (mirroring `useToggleFollow`), rollback on failure, and coverage across both the timeline cache and the user-tweets (profile) cache. New domain — no prior spec exists. 6 scenarios total.

## Requirements

### Requirement: Like Button With Visible Count
The system MUST render a like button on `TweetCard` showing the tweet's current like count, including zero.

#### Scenario: Like button renders with count, including zero
- GIVEN a rendered `TweetCard` for a tweet with `likesCount: 0` and `likedByMe: false`
- WHEN `TweetCard` renders
- THEN the system MUST display a like button showing a count of 0, distinguishable from a tweet with a non-zero count

### Requirement: Optimistic Like Toggle
The system MUST flip the like button and increment the displayed count immediately on click, before the server responds.

#### Scenario: Like flips optimistically and count increments
- GIVEN a rendered `TweetCard` for a tweet not yet liked by the session user, showing a known `likesCount`
- WHEN the user clicks the like button
- THEN the system MUST immediately flip the button to the "liked" state and increment the displayed count by 1, before the server responds

### Requirement: Optimistic Unlike Toggle
The system MUST flip the like button and decrement the displayed count immediately on click, before the server responds.

#### Scenario: Unlike flips optimistically and count decrements
- GIVEN a rendered `TweetCard` for a tweet already liked by the session user, showing a known `likesCount`
- WHEN the user clicks the like button
- THEN the system MUST immediately flip the button to the "not liked" state and decrement the displayed count by 1, before the server responds

### Requirement: Rollback on Mutation Failure
The system MUST revert both the button state and the displayed count to their prior values and surface an error when the like/unlike mutation fails.

#### Scenario: Rollback of button state and count, error surfaced on failure
- GIVEN an optimistic like/unlike toggle in flight on `TweetCard`
- WHEN the server request fails
- THEN the system MUST revert both the button state and the displayed `likesCount` to their prior values and surface an error

### Requirement: Like Works on Profile Page Tweets
The system MUST support the same optimistic like/unlike behavior for tweets rendered via the user-tweets (profile) cache, not only the timeline cache.

#### Scenario: Like toggle works on profile page tweets
- GIVEN a `TweetCard` rendered from the user-tweets cache on a profile page
- WHEN the user clicks the like button
- THEN the system MUST optimistically flip the button and count against the user-tweets cache, with the same rollback-on-failure behavior as the timeline cache

### Requirement: Existing TweetCard Behavior Unchanged
The system MUST NOT alter existing `TweetCard` delete behavior or existing `data-testid`s when adding the like button.

#### Scenario: Delete behavior and existing data-testids unchanged
- GIVEN a rendered `TweetCard` before and after the like button is added
- WHEN the component renders and existing interactions (e.g. delete) are exercised
- THEN all pre-existing `data-testid`s and delete behavior MUST remain unchanged, with the like button as an additive-only element
