import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { API_URL, makeNotification } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { useNotifications } from './useNotifications';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useNotifications', () => {
  it('fetches the first page of notifications', async () => {
    server.use(
      http.get(`${API_URL}/notifications`, () =>
        HttpResponse.json({
          items: [
            makeNotification({ id: 'n1', type: 'FOLLOW', tweetId: null }),
            makeNotification({ id: 'n2', type: 'LIKE' }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.pages[0]?.items.map((n) => n.id)).toEqual(['n1', 'n2']);
  });

  it('fetches the next page via fetchNextPage using the returned cursor', async () => {
    server.use(
      http.get(`${API_URL}/notifications`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor === 'n1') {
          return HttpResponse.json({
            items: [makeNotification({ id: 'n2' })],
            nextCursor: null,
            hasMore: false,
          });
        }
        return HttpResponse.json({
          items: [makeNotification({ id: 'n1' })],
          nextCursor: 'n1',
          hasMore: true,
        });
      }),
    );

    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.data?.pages[1]?.items[0]?.id).toBe('n2');
  });
});
