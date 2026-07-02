# Tweets Likes Enrichment Specification (API)

## Purpose

Defines like-related enrichment of the `PublicTweet` payload: every tweet returned by the timeline and by `GET /users/:username/tweets` carries `likesCount` (aggregate) and `likedByMe` (session-relative), computed in `TweetsService` via `_count.likes` plus one batched `like.findMany` per page. New domain — no prior spec exists. 6 scenarios total.

## Requirements

### Requirement: Timeline Tweets Carry Like Data
The system MUST include `likesCount` and session-relative `likedByMe` on every tweet returned by `GET /tweets/timeline`.

#### Scenario: Timeline tweets carry likesCount and likedByMe
- GIVEN the session user's timeline contains tweets, some liked by the session user and some not
- WHEN `GET /tweets/timeline` is called
- THEN every tweet in `items` MUST include `likesCount` and `likedByMe`, with `likedByMe` `true` only for tweets the session user has liked

### Requirement: User-Tweets Payload Carries Like Data
The system MUST include `likesCount` and session-relative `likedByMe` on every tweet returned by `GET /users/:username/tweets`.

#### Scenario: User-tweets page tweets carry likesCount and likedByMe
- GIVEN the session user calls `GET /users/:username/tweets` for a target user's tweets
- WHEN the response is returned
- THEN every tweet in `items` MUST include `likesCount` and `likedByMe`, computed relative to the session user

### Requirement: likedByMe Is Session-Relative
The system MUST compute `likedByMe` relative to the requesting session user, not the tweet's author or any other user.

#### Scenario: Same tweet, different likedByMe per session user
- GIVEN user A likes a tweet by author B, and user C has not liked that tweet
- WHEN A fetches a tweet list containing that tweet, and separately C fetches a tweet list containing that same tweet
- THEN A's copy of the tweet MUST show `likedByMe: true` and C's copy of the same tweet MUST show `likedByMe: false`

### Requirement: likesCount Aggregates Across All Likers
The system MUST compute `likesCount` as the total count of likes on the tweet, independent of who is asking.

#### Scenario: likesCount reflects multiple likers
- GIVEN a tweet liked by two different users
- WHEN any user fetches a tweet list containing that tweet
- THEN the tweet's `likesCount` MUST equal 2

### Requirement: New Tweets Start With No Likes
The system MUST return `likesCount: 0` and `likedByMe: false` for a tweet immediately after creation.

#### Scenario: Newly created tweet has zero likes
- GIVEN an authenticated user creates a new tweet
- WHEN the creation response is returned
- THEN the tweet MUST include `likesCount: 0` and `likedByMe: false`

### Requirement: Like-Then-Unlike Returns Count to Zero
The system MUST reflect an unlike by returning `likesCount` to its prior value in subsequently fetched tweet payloads.

#### Scenario: Count returns to zero after like then unlike
- GIVEN a tweet with `likesCount: 0` that the session user then likes and immediately unlikes
- WHEN the session user fetches a tweet list containing that tweet afterward
- THEN the tweet's `likesCount` MUST be 0 and `likedByMe` MUST be `false`
