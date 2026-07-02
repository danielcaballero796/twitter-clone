import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import Composer from '../tweets/Composer';
import TimelineFeed from '../tweets/TimelineFeed';
import { logout } from './api';
import { SESSION_QUERY_KEY, useSession } from './useSession';

export default function HomePage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p data-testid="shell-status" className="text-slate-900 dark:text-slate-100">
            Welcome, {user?.displayName ?? user?.username}
          </p>
          <Link
            to="/explore"
            className="cursor-pointer rounded text-sm font-semibold text-slate-600 transition-colors duration-200 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-slate-400 dark:hover:text-slate-100 dark:focus-visible:ring-offset-slate-950"
          >
            Explore
          </Link>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="h-9 w-fit cursor-pointer rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
        >
          Log out
        </button>
      </header>
      <Composer />
      <TimelineFeed />
    </div>
  );
}
