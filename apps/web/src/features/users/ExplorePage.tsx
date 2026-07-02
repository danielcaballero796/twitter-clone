import { useState } from 'react';
import SearchBox from './SearchBox';
import UserCard from './UserCard';
import { useSearchUsers } from './useSearchUsers';

function SkeletonUserRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3 w-1/3 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
        <div className="h-3 w-1/4 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const search = useSearchUsers(query);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Explore</h1>
      <SearchBox onSearch={setQuery} />
      {query.length === 0 ? null : search.isLoading ? (
        <div
          data-testid="explore-loading"
          className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
        >
          <SkeletonUserRow />
          <SkeletonUserRow />
        </div>
      ) : search.isError ? (
        <p
          data-testid="explore-error"
          role="alert"
          className="py-8 text-center text-sm text-red-600 dark:text-red-400"
        >
          Could not load search results. Please try again.
        </p>
      ) : search.data && search.data.items.length === 0 ? (
        <p
          data-testid="explore-empty"
          className="py-8 text-center text-sm text-slate-600 dark:text-slate-400"
        >
          No users found.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {search.data?.items.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </ul>
      )}
    </div>
  );
}
