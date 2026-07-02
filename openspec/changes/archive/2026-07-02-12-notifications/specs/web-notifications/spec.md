# Web Notifications Specification (Frontend)

## Purpose

Frontend UX for notifications: a `/notifications` page with an infinite newest-first feed, a nav badge showing the unread count, automatic mark-as-read on visit, and per-type rendering that links to the relevant content. 9 scenarios.

## Requirements

### Requirement: Notifications Page Feed
The `/notifications` route MUST render the session user's notifications newest first with infinite scroll, and MUST be protected (unauthenticated users redirected to login).

#### Scenario: Feed renders newest first
- GIVEN Alice has notifications spanning two pages
- WHEN she opens `/notifications`
- THEN the first page renders newest first

#### Scenario: Infinite scroll loads the next page
- GIVEN a loaded first page with `hasMore`
- WHEN the scroll sentinel becomes visible
- THEN the next page is appended without duplicates

### Requirement: Per-Type Rendering
Each notification MUST render the actor and an action label, linking LIKE and REPLY items to the tweet's thread (`/t/:id`) and FOLLOW items to the actor's profile.

#### Scenario: Like notification links to the thread
- GIVEN a LIKE notification from Bob on Alice's tweet
- WHEN it renders
- THEN it shows Bob as actor and links to that tweet's thread

#### Scenario: Follow notification links to the profile
- GIVEN a FOLLOW notification from Bob
- WHEN it renders
- THEN it links to Bob's profile

### Requirement: Unread Badge
The nav MUST show the unread count next to the notifications link, and MUST hide the badge when the count is zero.

#### Scenario: Badge shows the unread count
- GIVEN Alice has 3 unread notifications
- WHEN any protected page renders
- THEN the notifications nav item shows a badge with 3

#### Scenario: Badge hidden at zero
- GIVEN Alice has no unread notifications
- WHEN the nav renders
- THEN no badge is shown

### Requirement: Mark Read on Visit
Opening `/notifications` MUST mark all notifications as read and clear the badge.

#### Scenario: Visit clears unread state
- GIVEN Alice has unread notifications
- WHEN she opens `/notifications`
- THEN the mark-read request fires and the badge disappears

### Requirement: Feed States
The page MUST present loading (`role="status"`), error (`role="alert"`), and empty states.

#### Scenario: Empty state
- GIVEN Alice has no notifications
- WHEN she opens `/notifications`
- THEN an empty-state message renders with no error

#### Scenario: Error state
- GIVEN the API fails
- WHEN the page loads
- THEN an alert renders with a retry affordance
