import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UnreadCountResponse } from '@twitterclone/shared';
import { NOTIFICATIONS_QUERY_KEY, UNREAD_COUNT_QUERY_KEY } from '../../lib/queryKeys';
import { markAllRead } from './api';

/**
 * Mark-all-read mutation (design D7): zeroes the badge optimistically so the nav
 * updates the instant the notifications page opens, rolls back on failure, and
 * re-syncs both caches from the server once the request settles.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      const previousCount = queryClient.getQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY);
      queryClient.setQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY, { count: 0 });
      return { previousCount };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, context.previousCount);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}
