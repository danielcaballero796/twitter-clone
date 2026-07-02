import { useInfiniteQuery } from '@tanstack/react-query';
import { getUserTweets } from './api';

export const USER_TWEETS_QUERY_PREFIX = ['users', 'tweets'] as const;

export const userTweetsQueryKey = (username: string) =>
  [...USER_TWEETS_QUERY_PREFIX, username] as const;

export function useUserTweets(username: string) {
  return useInfiniteQuery({
    queryKey: userTweetsQueryKey(username),
    queryFn: ({ pageParam }) => getUserTweets(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
