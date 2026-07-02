import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CursorPage, PublicTweet } from '@twitterclone/shared';
import { deleteTweet } from './api';
import { TIMELINE_QUERY_KEY } from './useTimeline';

type TimelineData = InfiniteData<CursorPage<PublicTweet>, string | undefined>;

export function useDeleteTweet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTweet(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TIMELINE_QUERY_KEY });
      const previous = queryClient.getQueryData<TimelineData>(TIMELINE_QUERY_KEY);

      if (previous) {
        queryClient.setQueryData<TimelineData>(TIMELINE_QUERY_KEY, {
          ...previous,
          pages: previous.pages.map((page) => ({
            ...page,
            items: page.items.filter((tweet) => tweet.id !== id),
          })),
        });
      }

      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(TIMELINE_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEY }),
  });
}
