import { useEffect, useState } from 'react';

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
      <input
        id="explore-search"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search users…"
        className="w-full rounded border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
