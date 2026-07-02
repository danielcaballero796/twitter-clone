import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserListResponse, UserProfile } from '@twitterclone/shared';
import { TIMELINE_QUERY_KEY } from '../tweets/useTimeline';
import { followUser, unfollowUser } from './api';
import { SEARCH_USERS_QUERY_PREFIX } from './useSearchUsers';
import { PROFILE_QUERY_PREFIX, profileQueryKey } from './useProfile';

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

function flipProfile(nextIsFollowing: boolean, delta: number) {
  return (data: UserProfile | undefined): UserProfile | undefined => {
    if (!data) {
      return data;
    }
    return {
      ...data,
      isFollowing: nextIsFollowing,
      followersCount: data.followersCount + delta,
    };
  };
}

/**
 * Single toggle mutation — captures the target user's current follow state via closure so
 * callers only need `mutate()`. Flips `isFollowing` across every cached search-result query
 * AND the target's profile cache entry (if present), rolls back on error, and invalidates
 * search + the timeline + the profile prefix on settle.
 */
export function useToggleFollow({ username, isFollowing }: ToggleFollowInput) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => (isFollowing ? unfollowUser(username) : followUser(username)),
    onMutate: async () => {
      const nextIsFollowing = !isFollowing;

      await queryClient.cancelQueries({ queryKey: SEARCH_USERS_QUERY_PREFIX });
      await queryClient.cancelQueries({ queryKey: profileQueryKey(username) });

      const previous = queryClient.getQueriesData<UserListResponse>({
        queryKey: SEARCH_USERS_QUERY_PREFIX,
      });
      const previousProfile = queryClient.getQueryData<UserProfile>(profileQueryKey(username));

      queryClient.setQueriesData<UserListResponse>(
        { queryKey: SEARCH_USERS_QUERY_PREFIX },
        flipIsFollowing(username, nextIsFollowing),
      );

      if (previousProfile) {
        queryClient.setQueryData<UserProfile>(
          profileQueryKey(username),
          flipProfile(nextIsFollowing, nextIsFollowing ? 1 : -1),
        );
      }

      return { previous, previousProfile };
    },
    onError: (_error, _vars, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (context?.previousProfile) {
        queryClient.setQueryData(profileQueryKey(username), context.previousProfile);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SEARCH_USERS_QUERY_PREFIX });
      void queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_PREFIX });
    },
  });
}
