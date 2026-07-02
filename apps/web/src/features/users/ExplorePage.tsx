import { useState } from 'react';
import SearchBox from './SearchBox';
import UserCard from './UserCard';
import { useSearchUsers } from './useSearchUsers';

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const search = useSearchUsers(query);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <h1 className="text-lg font-bold">Explore</h1>
      <SearchBox onSearch={setQuery} />
      {query.length === 0 ? null : search.isLoading ? (
        <p data-testid="explore-loading" className="py-8 text-center text-sm text-slate-500">
          Searching…
        </p>
      ) : search.isError ? (
        <p
          data-testid="explore-error"
          role="alert"
          className="py-8 text-center text-sm text-red-600"
        >
          Could not load search results. Please try again.
        </p>
      ) : search.data && search.data.items.length === 0 ? (
        <p data-testid="explore-empty" className="py-8 text-center text-sm text-slate-500">
          No users found.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {search.data?.items.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </ul>
      )}
    </div>
  );
}
