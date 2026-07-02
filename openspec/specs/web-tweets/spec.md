# Web Tweets Specification (Frontend)

## Purpose

Defines frontend UX for tweet composition, timeline feed with infinite scroll, and deletion. New domain — no prior spec exists.

## Requirements

### Requirement: Composer Create Flow
The system MUST let an authenticated user type and submit a tweet, showing it in the timeline without a manual page reload.

#### Scenario: Successful create appears in timeline
- GIVEN the composer is empty
- WHEN the user types valid content and submits
- THEN the system MUST call the create endpoint and the new tweet MUST appear at the top of the timeline (optimistic or on refetch)

#### Scenario: Character counter reflects remaining chars
- GIVEN the composer has a 280-char limit
- WHEN the user types content
- THEN the system MUST display the remaining/used character count updating live

#### Scenario: Submission blocked over limit
- GIVEN content exceeding 280 chars
- WHEN the user attempts to submit
- THEN the system MUST disable submit and/or show an inline error, no request sent

### Requirement: Infinite Scroll Timeline
The system MUST load the timeline in pages and fetch the next page as the user scrolls near the end.

#### Scenario: Initial page loads on mount
- GIVEN the timeline route is opened
- WHEN the component mounts
- THEN the system MUST fetch and render the first page of tweets

#### Scenario: Next page loads on scroll
- GIVEN the first page is rendered and `hasMore` is true
- WHEN the user scrolls near the bottom of the feed
- THEN the system MUST fetch the next page via `useInfiniteQuery` and append it to the list

### Requirement: Tweet Deletion
The system MUST show a delete control only on the session user's own tweets and remove the tweet on confirmed deletion.

#### Scenario: Delete control restricted to own tweets
- GIVEN a timeline with tweets from the session user and others
- WHEN the feed renders
- THEN the system MUST show the delete button only on the session user's own tweets

#### Scenario: Confirmed delete removes tweet optimistically
- GIVEN the session user's own tweet with a delete button
- WHEN the user confirms deletion
- THEN the system MUST call the delete endpoint and remove the tweet from the visible list (optimistic update, rolled back on failure)

### Requirement: Empty Timeline State
The system MUST render a call-to-action empty state when the timeline has no tweets.

#### Scenario: Empty timeline shows CTA
- GIVEN the timeline query resolves with zero items
- WHEN the feed renders
- THEN the system MUST display an empty-state message with a CTA (e.g. compose a tweet), not a blank screen

### Requirement: Loading and Error States
The system MUST communicate fetch progress and failure to the user.

#### Scenario: Loading indicator while fetching
- GIVEN the timeline query is in flight
- WHEN the feed renders
- THEN the system MUST display a loading indicator instead of stale/empty content

#### Scenario: Error state on fetch failure
- GIVEN the timeline request fails
- WHEN the feed renders
- THEN the system MUST display an error state, not a silent blank feed
