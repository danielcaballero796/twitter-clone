import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '../../components/icons';

const DEBOUNCE_MS = 300;

interface SearchBoxProps {
  onSearch: (query: string) => void;
}

/** Debounces the raw input so callers (useSearchUsers) never fire a request per keystroke. */
export default function SearchBox({ onSearch }: SearchBoxProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <label htmlFor="explore-search" className="flex flex-col gap-1 text-sm">
      <span className="sr-only">Search users</span>
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          id="explore-search"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search users…"
          className="w-full rounded border border-slate-300 bg-white py-2 pl-10 pr-3 text-slate-900 transition-colors duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-offset-slate-950"
        />
      </div>
    </label>
  );
}
