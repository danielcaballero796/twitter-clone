import { useInfiniteQuery } from '@tanstack/react-query';
import { USER_TWEETS_QUERY_PREFIX, userTweetsQueryKey } from '../../lib/queryKeys';
import { getUserTweets } from './api';

export { USER_TWEETS_QUERY_PREFIX, userTweetsQueryKey };

export function useUserTweets(username: string) {
  return useInfiniteQuery({
    queryKey: userTweetsQueryKey(username),
    queryFn: ({ pageParam }) => getUserTweets(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
