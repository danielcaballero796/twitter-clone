import { useQuery } from '@tanstack/react-query';
import type { PublicUser } from '@twitterclone/shared';
import { SESSION_QUERY_KEY } from '../../lib/queryKeys';
import { fetchMe } from './api';

export { SESSION_QUERY_KEY };

export interface SessionState {
  user: PublicUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useSession(): SessionState {
  const query = useQuery<PublicUser | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchMe();
      } catch {
        // No valid session — resolve to unauthenticated instead of throwing.
        return null;
      }
    },
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(query.data),
  };
}
