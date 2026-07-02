import { useQuery } from '@tanstack/react-query';
import { UNREAD_COUNT_QUERY_KEY } from '../../lib/queryKeys';
import { fetchUnreadCount } from './api';

export { UNREAD_COUNT_QUERY_KEY };

export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: fetchUnreadCount,
  });
}
