# Notifications Specification (API)

## Purpose

Persistent notifications for social interactions: like, reply, and follow events fan out to a `Notification` record for the affected user, retrievable via authenticated endpoints with cursor pagination, an unread counter, and bulk mark-as-read. 17 scenarios.

## Requirements

### Requirement: Notification on Like
The system MUST create one LIKE notification for the tweet's author when another user likes their tweet, and MUST NOT notify self-likes.

#### Scenario: Like produces a notification
- GIVEN Bob likes Alice's tweet
- WHEN the like is created
- THEN a notification exists for Alice with type LIKE, actor Bob, and the tweet's id

#### Scenario: Self-like produces none
- GIVEN Alice likes her own tweet
- WHEN the like is created
- THEN no notification is created

### Requirement: Notification on Reply
The system MUST create one REPLY notification for the parent tweet's author when another user replies, referencing the reply tweet, and MUST NOT notify self-replies.

#### Scenario: Reply produces a notification
- GIVEN Bob replies to Alice's tweet
- WHEN the reply is created
- THEN a notification exists for Alice with type REPLY, actor Bob, and the reply's id

#### Scenario: Self-reply produces none
- GIVEN Alice replies to her own tweet
- WHEN the reply is created
- THEN no notification is created

### Requirement: Notification on Follow
The system MUST create one FOLLOW notification for the followed user, with no tweet reference.

#### Scenario: Follow produces a notification
- GIVEN Bob follows Alice
- WHEN the follow is created
- THEN a notification exists for Alice with type FOLLOW, actor Bob, and null tweet

### Requirement: Undo Removes the Notification
The system MUST delete the corresponding notification when its source action is undone (unlike, unfollow).

#### Scenario: Unlike removes the LIKE notification
- GIVEN Bob liked Alice's tweet, producing a notification
- WHEN Bob unlikes it
- THEN Alice's LIKE notification for that tweet and actor no longer exists

#### Scenario: Unfollow removes the FOLLOW notification
- GIVEN Bob follows Alice, producing a notification
- WHEN Bob unfollows her
- THEN Alice's FOLLOW notification from Bob no longer exists

### Requirement: Cascade Deletion
Notifications MUST be deleted when their referenced tweet, actor, or recipient is deleted.

#### Scenario: Deleting a tweet removes its notifications
- GIVEN a LIKE notification referencing Alice's tweet
- WHEN Alice deletes the tweet
- THEN the notification no longer exists

### Requirement: Notification Listing
`GET /notifications` MUST return only the session user's notifications, newest first, with cursor pagination (`limit`, `nextCursor`, `hasMore`), each item carrying type, read flag, createdAt, actor public info, and tweet reference when applicable. Unauthenticated requests MUST get 401; malformed cursors MUST get 400.

#### Scenario: Newest-first listing
- GIVEN Alice has notifications from separate moments
- WHEN Alice calls `GET /notifications`
- THEN items arrive newest first with actor and read fields

#### Scenario: Pagination follows cursor semantics
- GIVEN more notifications than `limit`
- WHEN Alice follows `nextCursor` pages
- THEN pages never overlap and `hasMore` is false on the last page

#### Scenario: Invalid cursor rejected
- WHEN Alice calls `GET /notifications?cursor=garbage`
- THEN the system MUST return 400

#### Scenario: Only own notifications
- GIVEN notifications belonging to Bob
- WHEN Alice lists her notifications
- THEN Bob's items never appear

#### Scenario: Unauthenticated listing rejected
- WHEN `GET /notifications` is called without a session
- THEN the system MUST return 401

### Requirement: Unread Count
`GET /notifications/unread-count` MUST return the count of the session user's unread notifications.

#### Scenario: Count reflects unread only
- GIVEN Alice has 2 unread and 1 read notification
- WHEN she calls the endpoint
- THEN it returns `{ count: 2 }`

#### Scenario: Zero when all read
- GIVEN Alice has no unread notifications
- WHEN she calls the endpoint
- THEN it returns `{ count: 0 }`

### Requirement: Mark All Read
`PATCH /notifications/read` MUST mark all the session user's notifications as read and MUST NOT affect other users.

#### Scenario: Marking clears unread
- GIVEN Alice has unread notifications
- WHEN she calls `PATCH /notifications/read`
- THEN her unread count becomes 0 and each item's read flag is true

#### Scenario: Other users unaffected
- GIVEN Bob has unread notifications
- WHEN Alice marks hers as read
- THEN Bob's unread count is unchanged

#### Scenario: Idempotent when nothing unread
- GIVEN Alice has no unread notifications
- WHEN she calls `PATCH /notifications/read`
- THEN the request succeeds with no change
