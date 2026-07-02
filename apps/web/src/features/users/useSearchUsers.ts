import { useQuery } from '@tanstack/react-query';
import { SEARCH_USERS_QUERY_PREFIX, searchUsersQueryKey } from '../../lib/queryKeys';
import { searchUsers } from './api';

export { SEARCH_USERS_QUERY_PREFIX, searchUsersQueryKey };

/** `q` is expected to already be debounced upstream by the caller (SearchBox). */
export function useSearchUsers(q: string) {
  return useQuery({
    queryKey: searchUsersQueryKey(q),
    queryFn: () => searchUsers(q),
    enabled: q.length > 0,
  });
}
