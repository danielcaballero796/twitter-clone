import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchTimeline } from './api';

export const TIMELINE_QUERY_KEY = ['timeline'] as const;

export function useTimeline() {
  return useInfiniteQuery({
    queryKey: TIMELINE_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchTimeline(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
