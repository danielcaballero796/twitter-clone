import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { API_URL, mockAuthor } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import NotificationsNavLink from './NotificationsNavLink';

const sessionUser = {
  id: mockAuthor.id,
  email: 'alice@example.com',
  username: mockAuthor.username,
  displayName: mockAuthor.displayName,
  bio: null,
  avatarUrl: mockAuthor.avatarUrl,
};

function renderNavLink() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationsNavLink />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationsNavLink', () => {
  it('renders nothing without a session', async () => {
    renderNavLink();

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /notifications/i })).not.toBeInTheDocument(),
    );
  });

  it('shows the unread count badge', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(sessionUser)),
      http.get(`${API_URL}/notifications/unread-count`, () => HttpResponse.json({ count: 3 })),
    );

    renderNavLink();

    expect(await screen.findByTestId('unread-badge')).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /notifications/i })).toHaveAttribute(
      'href',
      '/notifications',
    );
  });

  it('hides the badge when the count is zero', async () => {
    server.use(http.get(`${API_URL}/auth/me`, () => HttpResponse.json(sessionUser)));

    renderNavLink();

    await screen.findByRole('link', { name: /notifications/i });
    await waitFor(() => expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument());
  });
});
