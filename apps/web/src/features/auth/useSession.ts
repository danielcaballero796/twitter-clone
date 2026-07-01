import { useQuery } from '@tanstack/react-query';
import type { PublicUser } from '@twitterclone/shared';
import { fetchMe } from './api';

export const SESSION_QUERY_KEY = ['session'] as const;

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
