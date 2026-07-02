import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicUser, UpdateProfileRequest } from '@twitterclone/shared';
import {
  PROFILE_QUERY_PREFIX,
  SESSION_QUERY_KEY,
  TIMELINE_QUERY_KEY,
  USER_TWEETS_QUERY_PREFIX,
} from '../../lib/queryKeys';
import { updateProfile } from './api';

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
