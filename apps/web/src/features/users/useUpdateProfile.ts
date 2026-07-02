import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicUser, UpdateProfileRequest } from '@twitterclone/shared';
import { SESSION_QUERY_KEY } from '../auth/useSession';
import { TIMELINE_QUERY_KEY } from '../tweets/useTimeline';
import { updateProfile } from './api';
import { PROFILE_QUERY_PREFIX } from './useProfile';
import { USER_TWEETS_QUERY_PREFIX } from './useUserTweets';

/**
 * Saves profile edits. The response is the fresh session shape, so it seeds the
 * session cache directly; every surface rendering the edited identity (profile
 * header, timeline tweet authors, user-tweets feeds) is invalidated to refetch.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileRequest) => updateProfile(input),
    onSuccess: (updated: PublicUser) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, updated);
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_PREFIX });
      void queryClient.invalidateQueries({ queryKey: TIMELINE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: USER_TWEETS_QUERY_PREFIX });
    },
  });
}
