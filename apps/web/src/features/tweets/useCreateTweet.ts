import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CursorPage, PublicTweet, PublicUser } from '@twitterclone/shared';
import { SESSION_QUERY_KEY } from '../auth/useSession';
import { createTweet } from './api';
import { TIMELINE_QUERY_KEY } from './useTimeline';

type TimelineData = InfiniteData<CursorPage<PublicTweet>, string | undefined>;

export function useCreateTweet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => createTweet({ content }),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: TIMELINE_QUERY_KEY });
      const previous = queryClient.getQueryData<TimelineData>(TIMELINE_QUERY_KEY);
      const sessionUser = queryClient.getQueryData<PublicUser | null>(SESSION_QUERY_KEY);

      if (previous && previous.pages.length > 0 && sessionUser) {
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
        };
        queryClient.setQueryData<TimelineData>(TIMELINE_QUERY_KEY, {
          ...previous,
          pages: previous.pages.map((page, index) =>
            index === 0 ? { ...page, items: [optimistic, ...page.items] } : page,
          ),
        });
      }

      return { previous };
    },
    onError: (_error, _content, context) => {
      if (context?.previous) {
        queryClient.setQueryData(TIMELINE_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEY }),
  });
}
