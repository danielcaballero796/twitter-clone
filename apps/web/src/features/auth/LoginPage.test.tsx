import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { mockUser, renderAuthApp } from '../../test/render-auth-app';

describe('LoginPage', () => {
  it('navigates to the authenticated app (real ProtectedRoute) on successful login', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () => HttpResponse.json(mockUser)),
      // After a successful login the session cookie is valid, so /auth/me resolves.
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(mockUser)),
    );

    const user = userEvent.setup();
    renderAuthApp('/login');

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correct-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(screen.getByText(/welcome, alice/i)).toBeInTheDocument());
  });

  it('shows an inline error on wrong credentials without navigating', async () => {
    server.use(http.post(`${API_URL}/auth/login`, () => new HttpResponse(null, { status: 401 })));

    const user = userEvent.setup();
    renderAuthApp('/login');

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
  });
});
