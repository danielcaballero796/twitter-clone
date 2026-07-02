import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { API_URL, makeTweet } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { useReplies } from './useReplies';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useReplies', () => {
  it('fetches the first ascending page of replies', async () => {
    server.use(
      http.get(`${API_URL}/tweets/root/replies`, () =>
        HttpResponse.json({
          items: [
            makeTweet({ id: 'r1', content: 'first reply' }),
            makeTweet({ id: 'r2', content: 'second reply' }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    const { result } = renderHook(() => useReplies('root'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.pages[0]?.items.map((tweet) => tweet.id)).toEqual(['r1', 'r2']);
  });

  it('fetches the next page via fetchNextPage using the returned cursor', async () => {
    server.use(
      http.get(`${API_URL}/tweets/root/replies`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor === 'r1') {
          return HttpResponse.json({
            items: [makeTweet({ id: 'r2', content: 'second reply' })],
            nextCursor: null,
            hasMore: false,
          });
        }
        return HttpResponse.json({
          items: [makeTweet({ id: 'r1', content: 'first reply' })],
          nextCursor: 'r1',
          hasMore: true,
        });
      }),
    );

    const { result } = renderHook(() => useReplies('root'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.data?.pages[1]?.items[0]?.id).toBe('r2');
  });
});
