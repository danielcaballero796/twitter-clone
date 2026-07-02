import type { UserSummary } from '@twitterclone/shared';
import { useToggleFollow } from './useToggleFollow';

interface UserCardProps {
  user: UserSummary;
}

export default function UserCard({ user }: UserCardProps) {
  const toggleFollow = useToggleFollow({ username: user.username, isFollowing: user.isFollowing });

  return (
    <li className="flex items-center gap-3 py-3">
      <img
        src={user.avatarUrl}
        alt={`${user.displayName} avatar`}
        className="h-10 w-10 shrink-0 rounded-full bg-slate-100"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{user.displayName}</span>
        <span className="truncate text-sm text-slate-500">@{user.username}</span>
      </div>
      <button
        type="button"
        onClick={() => toggleFollow.mutate()}
        disabled={toggleFollow.isPending}
        className="shrink-0 rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
      >
        {user.isFollowing ? 'Following' : 'Follow'}
      </button>
      {toggleFollow.isError && (
        <p role="alert" className="text-xs text-red-600">
          Could not update follow status. Please try again.
        </p>
      )}
    </li>
  );
}
