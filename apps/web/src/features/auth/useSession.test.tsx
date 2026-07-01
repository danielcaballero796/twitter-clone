import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { API_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { mockUser } from '../../test/render-auth-app';
import { useSession } from './useSession';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSession', () => {
  it('resolves the authenticated user when /auth/me returns 200', async () => {
    server.use(http.get(`${API_URL}/auth/me`, () => HttpResponse.json(mockUser)));

    const { result } = renderHook(() => useSession(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('resolves unauthenticated without throwing when /auth/me returns 401', async () => {
    // Default MSW handler already returns 401 for /auth/me.
    const { result } = renderHook(() => useSession(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
