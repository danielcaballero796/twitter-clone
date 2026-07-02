import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { mockUser, renderAuthApp } from '../../test/render-auth-app';
import { SESSION_QUERY_KEY } from './useSession';

describe('HomePage', () => {
  it('shows a nav link to /explore', async () => {
    server.use(http.get(`${API_URL}/auth/me`, () => HttpResponse.json(mockUser)));

    renderAuthApp('/');

    await waitFor(() => expect(screen.getByText(/welcome, alice/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /explore/i })).toHaveAttribute('href', '/explore');
  });
});

describe('HomePage logout flow', () => {
  it('calls the logout endpoint, clears the cached session, and redirects to /login', async () => {
    let logoutCalled = false;
    let sessionActive = true;
    server.use(
      // Session is valid until logout flips it — mirrors the real cookie lifecycle.
      http.get(`${API_URL}/auth/me`, () =>
        sessionActive ? HttpResponse.json(mockUser) : new HttpResponse(null, { status: 401 }),
      ),
      http.post(`${API_URL}/auth/logout`, () => {
        logoutCalled = true;
        sessionActive = false;
        return HttpResponse.json({ success: true });
      }),
    );

    const user = userEvent.setup();
    const { queryClient } = renderAuthApp('/');

    await waitFor(() => expect(screen.getByText(/welcome, alice/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument(),
    );
    expect(logoutCalled).toBe(true);
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
    // Protected content is gone — subsequent access requires logging in again.
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
  });
});
