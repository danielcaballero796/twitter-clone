# Web Users Specification (Frontend)

## Purpose

Defines frontend UX for user search and follow/unfollow on a new protected `/explore` route. New domain — no prior spec exists.

## Requirements

### Requirement: Explore Route Navigation
The system MUST provide a protected `/explore` route reachable from Home via a link/nav entry, without altering HomePage's existing internals.

#### Scenario: Nav entry visible on Home
- GIVEN an authenticated user on the Home page
- WHEN the page renders
- THEN the system MUST show a link/nav entry to `/explore`

#### Scenario: Explore route protected
- GIVEN no authenticated session
- WHEN the user navigates to `/explore`
- THEN the system MUST redirect to the login flow (same behavior as other protected routes)

### Requirement: Debounced User Search
The system MUST let an authenticated user type a query and fetch matching users without firing a request per keystroke.

#### Scenario: Search fires after debounce
- GIVEN the search input is empty
- WHEN the user types a query
- THEN the system MUST wait for a debounce interval of inactivity before calling the search endpoint

#### Scenario: Loading indicator while searching
- GIVEN a search request is in flight
- WHEN the results area renders
- THEN the system MUST display a loading indicator instead of stale/empty content

#### Scenario: Empty results state
- GIVEN a query with zero matching users
- WHEN the search resolves
- THEN the system MUST display an empty-state message, not a blank list

#### Scenario: Error state on search failure
- GIVEN the search request fails
- WHEN the results area renders
- THEN the system MUST display an error state, not a silent blank list

### Requirement: Follow/Unfollow Optimistic Toggle
The system MUST let the user follow or unfollow a listed user with immediate visual feedback, rolled back on failure.

#### Scenario: Follow button flips optimistically
- GIVEN a user card showing "Follow" for a not-yet-followed user
- WHEN the user clicks the follow button
- THEN the system MUST immediately flip the button to "Following" before the server responds

#### Scenario: Unfollow button flips optimistically
- GIVEN a user card showing "Following" for a followed user
- WHEN the user clicks the unfollow button
- THEN the system MUST immediately flip the button to "Follow" before the server responds

#### Scenario: Rollback on follow/unfollow failure
- GIVEN an optimistic follow/unfollow toggle in flight
- WHEN the server request fails
- THEN the system MUST revert the button to its prior state and surface an error

### Requirement: Mandatory Follow Flow Coverage
The system MUST have an automated test covering the full search-to-timeline follow flow.

#### Scenario: Search, follow, and timeline reflects it
- GIVEN an authenticated user on `/explore`
- WHEN the user searches for a target user, clicks follow, the button flips, and the timeline is refetched
- THEN the test MUST assert the target user's tweets now appear in the timeline
