import { useInfiniteQuery } from '@tanstack/react-query';
import { repliesQueryKey } from '../../lib/queryKeys';
import { fetchReplies } from './api';

export { repliesQueryKey };

export function useReplies(id: string) {
  return useInfiniteQuery({
    queryKey: repliesQueryKey(id),
    queryFn: ({ pageParam }) => fetchReplies(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
