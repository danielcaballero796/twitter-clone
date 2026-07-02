import { useInfiniteQuery } from '@tanstack/react-query';
import { NOTIFICATIONS_QUERY_KEY } from '../../lib/queryKeys';
import { fetchNotifications } from './api';

export { NOTIFICATIONS_QUERY_KEY };

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
