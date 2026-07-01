import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { logout } from './api';
import { SESSION_QUERY_KEY, useSession } from './useSession';

/** Minimal authenticated landing page — the real home feed ships in change 03. */
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
    <div className="flex flex-col gap-4">
      <p data-testid="shell-status">Welcome, {user?.displayName ?? user?.username}</p>
      <button
        type="button"
        onClick={handleLogout}
        className="w-fit rounded border border-slate-300 px-4 py-2 text-sm"
      >
        Log out
      </button>
    </div>
  );
}
