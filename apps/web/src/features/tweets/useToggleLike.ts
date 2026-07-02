import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CursorPage, PublicTweet } from '@twitterclone/shared';
import { USER_TWEETS_QUERY_PREFIX } from '../users/useUserTweets';
import { likeTweet, unlikeTweet } from './api';
import { TIMELINE_QUERY_KEY } from './useTimeline';

type TweetsPageData = InfiniteData<CursorPage<PublicTweet>, string | undefined>;

interface ToggleLikeInput {
  tweetId: string;
  likedByMe: boolean;
}

function flipLike(tweetId: string, nextLikedByMe: boolean, delta: number) {
  return (data: TweetsPageData | undefined): TweetsPageData | undefined => {
    if (!data) {
      return data;
    }
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((tweet) =>
          tweet.id === tweetId
            ? { ...tweet, likedByMe: nextLikedByMe, likesCount: tweet.likesCount + delta }
            : tweet,
        ),
      })),
    };
  };
}

/**
 * Single toggle mutation — captures the target tweet's current like state via closure so
 * callers only need `mutate()`. Flips `likedByMe`/`likesCount` across BOTH the timeline cache
 * and the user-tweets (profile) cache for the target tweet only, rolls back both on error, and
 * invalidates both prefixes on settle.
 */
export function useToggleLike({ tweetId, likedByMe }: ToggleLikeInput) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => (likedByMe ? unlikeTweet(tweetId) : likeTweet(tweetId)),
    onMutate: async () => {
      const nextLikedByMe = !likedByMe;
      const delta = nextLikedByMe ? 1 : -1;

      await queryClient.cancelQueries({ queryKey: TIMELINE_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: USER_TWEETS_QUERY_PREFIX });

      const previousTimeline = queryClient.getQueriesData<TweetsPageData>({
        queryKey: TIMELINE_QUERY_KEY,
      });
      const previousUserTweets = queryClient.getQueriesData<TweetsPageData>({
        queryKey: USER_TWEETS_QUERY_PREFIX,
      });

      queryClient.setQueriesData<TweetsPageData>(
        { queryKey: TIMELINE_QUERY_KEY },
        flipLike(tweetId, nextLikedByMe, delta),
      );
      queryClient.setQueriesData<TweetsPageData>(
        { queryKey: USER_TWEETS_QUERY_PREFIX },
        flipLike(tweetId, nextLikedByMe, delta),
      );

      return { previousTimeline, previousUserTweets };
    },
    onError: (_error, _vars, context) => {
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
