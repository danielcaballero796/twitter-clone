import { useQuery } from '@tanstack/react-query';
import { PROFILE_QUERY_PREFIX, profileQueryKey } from '../../lib/queryKeys';
import { getProfile } from './api';

export { PROFILE_QUERY_PREFIX, profileQueryKey };

export function useProfile(username: string) {
  return useQuery({
    queryKey: profileQueryKey(username),
    queryFn: () => getProfile(username),
  });
}
