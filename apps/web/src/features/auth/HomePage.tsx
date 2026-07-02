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
          <p data-testid="shell-status">Welcome, {user?.displayName ?? user?.username}</p>
          <Link to="/explore" className="text-sm font-semibold text-slate-600 hover:underline">
            Explore
          </Link>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-fit rounded border border-slate-300 px-4 py-2 text-sm"
        >
          Log out
        </button>
      </header>
      <Composer />
      <TimelineFeed />
    </div>
  );
}
