import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { API_URL, mockAuthor } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import ProfileNavLink from './ProfileNavLink';

function renderNavLink() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfileNavLink />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProfileNavLink', () => {
  it('renders nothing without a session', async () => {
    // Default MSW handler returns 401 for /auth/me — no session.
    renderNavLink();

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /profile/i })).not.toBeInTheDocument(),
    );
  });

  it('links to the session user own profile when authenticated', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json({
          id: mockAuthor.id,
          email: 'alice@example.com',
          username: mockAuthor.username,
          displayName: mockAuthor.displayName,
          bio: null,
          avatarStyle: 'identicon',
          avatarUrl: mockAuthor.avatarUrl,
        }),
      ),
    );

    renderNavLink();

    const link = await screen.findByRole('link', { name: /profile/i });
    expect(link).toHaveAttribute('href', `/u/${mockAuthor.username}`);
  });
});
