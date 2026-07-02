# Web Tweets Specification (Frontend) — Reply Threads Delta

## Purpose

Extends the tweet card and timeline UX with reply affordances and a thread page: every card shows a reply count/link, reply cards carry a "Replying to @user" marker, and `/t/:id` renders a root tweet plus its flat chronological reply list with infinite scroll and a reply composer. 9 scenarios total.

## Requirements

### Requirement: Reply Count and Affordance on TweetCard
The system MUST show a reply count and a reply affordance on every tweet card, linking to that tweet's thread page.

#### Scenario: Reply count and link rendered on every card
- GIVEN a timeline or profile list with tweets carrying varying `replyCount` values
- WHEN the feed renders
- THEN each card MUST display its `replyCount` and a control/link that navigates to `/t/:id` for that tweet

### Requirement: Reply Context Marker
The system MUST render a "Replying to @user" marker on any card whose tweet has a non-null `inReplyTo`, linking to the parent's thread.

#### Scenario: Reply card shows parent context
- GIVEN a tweet in the feed with `inReplyTo: { id, username: "ada" }`
- WHEN the card renders
- THEN it MUST display "Replying to @ada" as a link to `/t/:id` of the parent

#### Scenario: Top-level card shows no reply marker
- GIVEN a tweet in the feed with `inReplyTo: null`
- WHEN the card renders
- THEN it MUST NOT display a reply-context marker

### Requirement: Thread Page Renders Root and Replies
The system MUST render, at route `/t/:id`, the root tweet followed by a flat chronological list of its direct replies with infinite scroll.

#### Scenario: Thread page shows root tweet and replies in order
- GIVEN a tweet with three replies posted in sequence
- WHEN `/t/:id` is opened for that tweet
- THEN the page MUST render the root tweet first, then the replies in oldest-first order

#### Scenario: Thread page loads next page of replies on scroll
- GIVEN the thread page's first page of replies is rendered and `hasMore` is true
- WHEN the user scrolls near the bottom of the reply list
- THEN the system MUST fetch and append the next page via `useInfiniteQuery`, reusing the timeline pagination pattern

#### Scenario: Thread with no replies shows only the root
- GIVEN a tweet with zero replies
- WHEN `/t/:id` is opened for that tweet
- THEN the page MUST render the root tweet and no reply items, without an error state

#### Scenario: Unknown thread id shows not-found state
- GIVEN no tweet exists with id X
- WHEN `/t/:unknownId` is opened for X
- THEN the page MUST display a not-found state, not a blank screen or crash

### Requirement: Reply Composer on Thread Page
The system MUST let an authenticated user post a reply from the thread page, with the new reply appearing in the thread and the parent's reply count updating without a manual page reload.

#### Scenario: Posted reply appears in the thread and bumps parent count
- GIVEN the thread page for tweet X is open with the composer visible
- WHEN the user types valid content and submits
- THEN the system MUST call the create endpoint with `parentId: X.id`, the new reply MUST appear in the thread's reply list (optimistic or on refetch), and X's `replyCount` MUST reflect the increment wherever X is displayed

### Requirement: Delete Confirmation Reflects Reply Count
The system MUST surface the reply count in the delete-confirmation copy when deleting a tweet that has replies, warning that the subtree will be removed.

#### Scenario: Delete confirmation warns about reply subtree
- GIVEN the session user's own tweet with `replyCount > 0` and a delete control
- WHEN the user initiates deletion
- THEN the confirmation copy MUST reference the reply count and indicate the replies will also be removed
