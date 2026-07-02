import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { API_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { useUnreadCount } from './useUnreadCount';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUnreadCount', () => {
  it('returns the unread count from the API', async () => {
    server.use(
      http.get(`${API_URL}/notifications/unread-count`, () => HttpResponse.json({ count: 3 })),
    );

    const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ count: 3 });
  });

  it('returns zero from the default handler', async () => {
    const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ count: 0 });
  });
});
