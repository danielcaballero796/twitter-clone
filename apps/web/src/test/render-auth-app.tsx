import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { PublicUser } from '@twitterclone/shared';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HomePage from '../features/auth/HomePage';
import LoginPage from '../features/auth/LoginPage';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import RegisterPage from '../features/auth/RegisterPage';
import ExplorePage from '../features/users/ExplorePage';
import ProfilePage from '../features/users/ProfilePage';

export const mockUser: PublicUser = {
  id: '1',
  email: 'alice@example.com',
  username: 'alice',
  displayName: 'Alice',
  bio: null,
  avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=alice',
};

/**
 * Renders the REAL auth route tree (LoginPage, RegisterPage, ProtectedRoute + HomePage)
 * so routing tests exercise the actual guard, not a stand-in stub.
 */
export function renderAuthApp(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/u/:username" element={<ProfilePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}
