import { useInfiniteQuery } from '@tanstack/react-query';
import { TIMELINE_QUERY_KEY } from '../../lib/queryKeys';
import { fetchTimeline } from './api';

export { TIMELINE_QUERY_KEY };

export function useTimeline() {
  return useInfiniteQuery({
    queryKey: TIMELINE_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchTimeline(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
