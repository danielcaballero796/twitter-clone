import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { APP_NAME } from '@twitterclone/shared';
import ThemeToggle from './features/theme/ThemeToggle';
import HomePage from './features/auth/HomePage';
import LoginPage from './features/auth/LoginPage';
import ProtectedRoute from './features/auth/ProtectedRoute';
import RegisterPage from './features/auth/RegisterPage';
import ExplorePage from './features/users/ExplorePage';
import ProfilePage from './features/users/ProfilePage';

function navLinkClassName({ isActive }: { isActive: boolean }) {
  const base = 'rounded px-2 py-1 text-sm transition-colors duration-200 cursor-pointer';
  return isActive
    ? `${base} font-medium text-indigo-600 dark:text-indigo-400`
    : `${base} text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100`;
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950/80">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
              <h1 className="text-xl font-bold">
                <Link
                  to="/"
                  className="rounded text-indigo-600 transition-colors duration-200 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-indigo-400 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-slate-950"
                >
                  {APP_NAME}
                </Link>
              </h1>
              <nav className="flex items-center gap-1">
                <NavLink to="/" end className={navLinkClassName}>
                  Home
                </NavLink>
                <NavLink to="/explore" className={navLinkClassName}>
                  Explore
                </NavLink>
              </nav>
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto max-w-2xl px-4 py-6">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/u/:username" element={<ProfilePage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
