import { useQuery } from '@tanstack/react-query';
import { searchUsers } from './api';

/** Shared prefix so mutations can flip/invalidate every cached search result at once. */
export const SEARCH_USERS_QUERY_PREFIX = ['users', 'search'] as const;

export const searchUsersQueryKey = (q: string) => [...SEARCH_USERS_QUERY_PREFIX, q] as const;

/** `q` is expected to already be debounced upstream by the caller (SearchBox). */
export function useSearchUsers(q: string) {
  return useQuery({
    queryKey: searchUsersQueryKey(q),
    queryFn: () => searchUsers(q),
    enabled: q.length > 0,
  });
}
