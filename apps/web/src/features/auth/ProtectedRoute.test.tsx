import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { API_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { mockUser, renderAuthApp } from '../../test/render-auth-app';

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', async () => {
    // Default MSW handler returns 401 for /auth/me → no session.
    renderAuthApp('/');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
  });

  it('renders the protected content for an authenticated session without redirecting', async () => {
    server.use(http.get(`${API_URL}/auth/me`, () => HttpResponse.json(mockUser)));

    renderAuthApp('/');

    await waitFor(() => expect(screen.getByText(/welcome, alice/i)).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: /log in/i })).not.toBeInTheDocument();
  });
});
