import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CursorPage, PublicTweet } from '@twitterclone/shared';
import { USER_TWEETS_QUERY_PREFIX } from '../users/useUserTweets';
import { deleteTweet } from './api';
import { TIMELINE_QUERY_KEY } from './useTimeline';

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
 * (profile) cache, rolls back both on error, and invalidates both prefixes on settle — mirrors
 * useToggleLike's dual-cache handling so a delete from either surface stays consistent.
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
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: USER_TWEETS_QUERY_PREFIX });
    },
  });
}
