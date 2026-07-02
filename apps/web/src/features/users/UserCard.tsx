import type { UserSummary } from '@twitterclone/shared';
import { Link } from 'react-router-dom';
import { useToggleFollow } from './useToggleFollow';

interface UserCardProps {
  user: UserSummary;
}

export default function UserCard({ user }: UserCardProps) {
  const toggleFollow = useToggleFollow({ username: user.username, isFollowing: user.isFollowing });

  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-slate-900/60">
      <img
        src={user.avatarUrl}
        alt={`${user.displayName} avatar`}
        className="h-10 w-10 shrink-0 rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-800"
      />
      <Link
        to={`/u/${user.username}`}
        className="flex min-w-0 flex-1 flex-col rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      >
        <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
          {user.displayName}
        </span>
        <span className="truncate text-sm text-slate-600 dark:text-slate-400">
          @{user.username}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => toggleFollow.mutate()}
        disabled={toggleFollow.isPending}
        className={`h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-950 ${
          user.isFollowing
            ? 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400'
        }`}
      >
        {user.isFollowing ? 'Following' : 'Follow'}
      </button>
      {toggleFollow.isError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Could not update follow status. Please try again.
        </p>
      )}
    </li>
  );
}
