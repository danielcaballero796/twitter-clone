import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CursorPage, PublicTweet } from '@twitterclone/shared';
import { TIMELINE_QUERY_KEY, USER_TWEETS_QUERY_PREFIX } from '../../lib/queryKeys';
import { deleteTweet } from './api';

type TweetsPageData = InfiniteData<CursorPage<PublicTweet>, string | undefined>;

function removeTweet(id: string) {
  return (data: TweetsPageData | undefined): TweetsPageData | undefined => {
    if (!data) {
      return data;
    }
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.filter((tweet) => tweet.id !== id),
      })),
    };
  };
}

/**
 * Optimistically removes the deleted tweet from BOTH the timeline cache and the user-tweets
 * (profile) cache, and rolls back both on error — mirrors useToggleLike's dual-cache handling
 * so a delete from either surface stays consistent. The optimistic patch already reflects the
 * real end state, so there's no onSettled invalidation; on error we invalidate as a safety net
 * after the rollback in case the cache had drifted for another reason.
 */
export function useDeleteTweet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTweet(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TIMELINE_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: USER_TWEETS_QUERY_PREFIX });

      const previousTimeline = queryClient.getQueriesData<TweetsPageData>({
        queryKey: TIMELINE_QUERY_KEY,
      });
      const previousUserTweets = queryClient.getQueriesData<TweetsPageData>({
        queryKey: USER_TWEETS_QUERY_PREFIX,
      });

      queryClient.setQueriesData<TweetsPageData>({ queryKey: TIMELINE_QUERY_KEY }, removeTweet(id));
      queryClient.setQueriesData<TweetsPageData>(
        { queryKey: USER_TWEETS_QUERY_PREFIX },
        removeTweet(id),
      );

      return { previousTimeline, previousUserTweets };
    },
    onError: (_error, _id, context) => {
      context?.previousTimeline.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousUserTweets.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      void queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: USER_TWEETS_QUERY_PREFIX });
    },
  });
}
