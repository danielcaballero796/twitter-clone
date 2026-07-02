import { useQuery } from '@tanstack/react-query';
import { tweetQueryKey } from '../../lib/queryKeys';
import { fetchTweet } from './api';

export { tweetQueryKey };

export function useTweet(id: string) {
  return useQuery({
    queryKey: tweetQueryKey(id),
    queryFn: () => fetchTweet(id),
  });
}
