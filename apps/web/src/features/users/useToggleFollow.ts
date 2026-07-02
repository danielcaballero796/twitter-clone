import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserListResponse } from '@twitterclone/shared';
import { TIMELINE_QUERY_KEY } from '../tweets/useTimeline';
import { followUser, unfollowUser } from './api';
import { SEARCH_USERS_QUERY_PREFIX } from './useSearchUsers';

interface ToggleFollowInput {
  username: string;
  isFollowing: boolean;
}

function flipIsFollowing(username: string, nextIsFollowing: boolean) {
  return (data: UserListResponse | undefined): UserListResponse | undefined => {
    if (!data) {
      return data;
    }
    return {
      items: data.items.map((item) =>
        item.username === username ? { ...item, isFollowing: nextIsFollowing } : item,
      ),
    };
  };
}

/**
 * Single toggle mutation — captures the target user's current follow state via closure so
 * callers only need `mutate()`. Flips `isFollowing` across every cached search-result query,
 * rolls back on error, and invalidates search + the timeline on settle.
 */
export function useToggleFollow({ username, isFollowing }: ToggleFollowInput) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => (isFollowing ? unfollowUser(username) : followUser(username)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: SEARCH_USERS_QUERY_PREFIX });
      const previous = queryClient.getQueriesData<UserListResponse>({
        queryKey: SEARCH_USERS_QUERY_PREFIX,
      });

      queryClient.setQueriesData<UserListResponse>(
        { queryKey: SEARCH_USERS_QUERY_PREFIX },
        flipIsFollowing(username, !isFollowing),
      );

      return { previous };
    },
    onError: (_error, _vars, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SEARCH_USERS_QUERY_PREFIX });
      void queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEY });
    },
  });
}
