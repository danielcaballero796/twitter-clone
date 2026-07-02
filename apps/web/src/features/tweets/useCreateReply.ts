import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CursorPage, PublicTweet, PublicUser } from '@twitterclone/shared';
import {
  SESSION_QUERY_KEY,
  TIMELINE_QUERY_KEY,
  tweetQueryKey,
  USER_TWEETS_QUERY_PREFIX,
  repliesQueryKey,
} from '../../lib/queryKeys';
import { createTweet } from './api';

type TweetsPageData = InfiniteData<CursorPage<PublicTweet>, string | undefined>;

function bumpReplyCount(delta: number) {
  return (tweet: PublicTweet | undefined): PublicTweet | undefined =>
    tweet ? { ...tweet, replyCount: tweet.replyCount + delta } : tweet;
}

function bumpReplyCountInPages(id: string, delta: number) {
  return (data: TweetsPageData | undefined): TweetsPageData | undefined => {
    if (!data) {
      return data;
    }
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((tweet) =>
          tweet.id === id ? { ...tweet, replyCount: tweet.replyCount + delta } : tweet,
        ),
      })),
    };
  };
}

function appendOptimisticReply(reply: PublicTweet) {
  return (data: TweetsPageData | undefined): TweetsPageData | undefined => {
    if (!data || data.pages.length === 0) {
      return data;
    }
    const lastIndex = data.pages.length - 1;
    return {
      ...data,
      pages: data.pages.map((page, index) =>
        index === lastIndex ? { ...page, items: [...page.items, reply] } : page,
      ),
    };
  };
}

/**
 * Dedicated reply mutation (D5) — distinct from `useCreateTweet` because a reply patches a
 * different cache shape: it appends to the *end* of the parent's replies list (ascending/oldest-
 * first) instead of prepending to the timeline, and it also bumps `replyCount` on the parent
 * tweet wherever it's cached (timeline, profile, thread-root single-tweet cache).
 */
export function useCreateReply(parentId: string) {
  const queryClient = useQueryClient();
  const repliesKey = repliesQueryKey(parentId);
  const tweetKey = tweetQueryKey(parentId);

  return useMutation({
    mutationFn: (content: string) => createTweet({ content, parentId }),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: repliesKey });
      await queryClient.cancelQueries({ queryKey: TIMELINE_QUERY_KEY });
      await queryClient.cancelQueries({ queryKey: USER_TWEETS_QUERY_PREFIX });
      await queryClient.cancelQueries({ queryKey: tweetKey });

      const previousReplies = queryClient.getQueryData<TweetsPageData>(repliesKey);
      const previousTimeline = queryClient.getQueriesData<TweetsPageData>({
        queryKey: TIMELINE_QUERY_KEY,
      });
      const previousUserTweets = queryClient.getQueriesData<TweetsPageData>({
        queryKey: USER_TWEETS_QUERY_PREFIX,
      });
      const previousTweet = queryClient.getQueryData<PublicTweet>(tweetKey);

      const sessionUser = queryClient.getQueryData<PublicUser | null>(SESSION_QUERY_KEY);

      if (sessionUser) {
        const optimistic: PublicTweet = {
          id: `optimistic-${Date.now()}`,
          content,
          createdAt: new Date().toISOString(),
          author: {
            id: sessionUser.id,
            username: sessionUser.username,
            displayName: sessionUser.displayName,
            avatarUrl: sessionUser.avatarUrl,
          },
          likesCount: 0,
          likedByMe: false,
          replyCount: 0,
          inReplyTo: previousTweet
            ? { id: previousTweet.id, username: previousTweet.author.username }
            : { id: parentId, username: '' },
        };
        queryClient.setQueryData<TweetsPageData>(repliesKey, appendOptimisticReply(optimistic));
      }

      queryClient.setQueriesData<TweetsPageData>(
        { queryKey: TIMELINE_QUERY_KEY },
        bumpReplyCountInPages(parentId, 1),
      );
      queryClient.setQueriesData<TweetsPageData>(
        { queryKey: USER_TWEETS_QUERY_PREFIX },
        bumpReplyCountInPages(parentId, 1),
      );
      queryClient.setQueryData<PublicTweet>(tweetKey, bumpReplyCount(1));

      return { previousReplies, previousTimeline, previousUserTweets, previousTweet };
    },
    onError: (_error, _content, context) => {
      if (context?.previousReplies) {
        queryClient.setQueryData(repliesKey, context.previousReplies);
      }
      context?.previousTimeline.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousUserTweets.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (context?.previousTweet !== undefined) {
        queryClient.setQueryData(tweetKey, context.previousTweet);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: repliesKey }),
  });
}
