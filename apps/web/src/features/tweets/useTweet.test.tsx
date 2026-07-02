import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { API_URL, makeTweet } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { ApiError } from '../../lib/api';
import { useTweet } from './useTweet';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useTweet', () => {
  it('is loading, then resolves with the tweet', async () => {
    server.use(
      http.get(`${API_URL}/tweets/t1`, () =>
        HttpResponse.json(makeTweet({ id: 't1', content: 'the root tweet' })),
      ),
    );

    const { result } = renderHook(() => useTweet('t1'), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.content).toBe('the root tweet');
  });

  it('surfaces a 404 ApiError when the tweet does not exist', async () => {
    server.use(
      http.get(
        `${API_URL}/tweets/ghost`,
        () => new HttpResponse(JSON.stringify({ message: 'Tweet not found' }), { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useTweet('ghost'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(404);
  });
});
