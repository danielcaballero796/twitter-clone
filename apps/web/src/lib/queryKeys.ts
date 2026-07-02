/**
 * Single source of truth for every TanStack Query key/prefix used across the app.
 * Hook files re-export the constants they own so existing imports (`from './useTimeline'`,
 * `from './useProfile'`, etc.) keep working without touching every call site.
 */

export const SESSION_QUERY_KEY = ['session'] as const;

export const TIMELINE_QUERY_KEY = ['timeline'] as const;

/** Shared prefix so mutations can flip/invalidate every cached user-tweets page at once. */
export const USER_TWEETS_QUERY_PREFIX = ['users', 'tweets'] as const;

export const userTweetsQueryKey = (username: string) =>
  [...USER_TWEETS_QUERY_PREFIX, username] as const;

/** Shared prefix so mutations can flip/invalidate every cached search result at once. */
export const SEARCH_USERS_QUERY_PREFIX = ['users', 'search'] as const;

export const searchUsersQueryKey = (q: string) => [...SEARCH_USERS_QUERY_PREFIX, q] as const;

/** Shared prefix so the follow mutation can flip/invalidate every cached profile at once. */
export const PROFILE_QUERY_PREFIX = ['users', 'profile'] as const;

export const profileQueryKey = (username: string) => [...PROFILE_QUERY_PREFIX, username] as const;

/** Shared prefix for a single thread-root tweet cache (`GET /tweets/:id`). */
export const TWEET_QUERY_PREFIX = ['tweet'] as const;

export const tweetQueryKey = (id: string) => [...TWEET_QUERY_PREFIX, id] as const;

/** Shared prefix so mutations can flip/invalidate every cached replies page at once. */
export const REPLIES_QUERY_PREFIX = ['replies'] as const;

export const repliesQueryKey = (id: string) => [...REPLIES_QUERY_PREFIX, id] as const;
