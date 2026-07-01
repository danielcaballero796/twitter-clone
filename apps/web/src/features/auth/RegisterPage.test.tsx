import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { mockUser, renderAuthApp } from '../../test/render-auth-app';

async function fillRegisterForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
  await user.type(screen.getByLabelText(/username/i), 'alice');
  await user.type(screen.getByLabelText(/display name/i), 'Alice');
  await user.type(screen.getByLabelText(/password/i), 'supersecret');
  await user.click(screen.getByRole('button', { name: /create account/i }));
}

describe('RegisterPage', () => {
  it('navigates to the authenticated app (real ProtectedRoute) on successful registration', async () => {
    server.use(
      http.post(`${API_URL}/auth/register`, () => HttpResponse.json(mockUser, { status: 201 })),
      // The session is active after registration, so /auth/me resolves.
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(mockUser)),
    );

    const user = userEvent.setup();
    renderAuthApp('/register');

    await fillRegisterForm(user);

    await waitFor(() => expect(screen.getByText(/welcome, alice/i)).toBeInTheDocument());
  });

  it('shows the backend conflict message inline on duplicate email/username without navigating', async () => {
    server.use(
      http.post(`${API_URL}/auth/register`, () =>
        HttpResponse.json(
          {
            statusCode: 409,
            message: 'A user with that email already exists',
            error: 'Conflict',
          },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderAuthApp('/register');

    await fillRegisterForm(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /a user with that email already exists/i,
    );
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });
});
