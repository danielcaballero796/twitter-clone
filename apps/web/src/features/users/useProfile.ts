import { useQuery } from '@tanstack/react-query';
import { getProfile } from './api';

/** Shared prefix so the follow mutation can flip/invalidate every cached profile at once. */
export const PROFILE_QUERY_PREFIX = ['users', 'profile'] as const;

export const profileQueryKey = (username: string) => [...PROFILE_QUERY_PREFIX, username] as const;

export function useProfile(username: string) {
  return useQuery({
    queryKey: profileQueryKey(username),
    queryFn: () => getProfile(username),
  });
}
