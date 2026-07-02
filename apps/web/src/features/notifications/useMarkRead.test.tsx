import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import type { UnreadCountResponse } from '@twitterclone/shared';
import { UNREAD_COUNT_QUERY_KEY } from '../../lib/queryKeys';
import { API_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { useMarkRead } from './useMarkRead';

function createClientAndWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

describe('useMarkRead', () => {
  it('optimistically zeroes the unread count', async () => {
    const { queryClient, Wrapper } = createClientAndWrapper();
    queryClient.setQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY, { count: 5 });

    const { result } = renderHook(() => useMarkRead(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() =>
      expect(queryClient.getQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY)).toEqual({
        count: 0,
      }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls the count back when the request fails', async () => {
    server.use(
      http.patch(`${API_URL}/notifications/read`, () => new HttpResponse(null, { status: 500 })),
    );
    const { queryClient, Wrapper } = createClientAndWrapper();
    queryClient.setQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY, { count: 5 });

    const { result } = renderHook(() => useMarkRead(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY)).toEqual({
      count: 5,
    });
  });
});
