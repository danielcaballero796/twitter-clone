import { type FormEvent, useState } from 'react';
import { ArrowPathIcon } from '../../components/icons';
import { useCreateTweet } from './useCreateTweet';

const MAX_TWEET_LENGTH = 280;

export default function Composer() {
  const [content, setContent] = useState('');
  const createTweet = useCreateTweet();

  const remaining = MAX_TWEET_LENGTH - content.length;
  const overLimit = remaining < 0;
  const empty = content.trim().length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (empty || overLimit) {
      return;
    }
    createTweet.mutate(content.trim(), { onSuccess: () => setContent('') });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <label htmlFor="composer-content" className="sr-only">
        What&apos;s happening?
      </label>
      <textarea
        id="composer-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's happening?"
        rows={3}
        className="w-full resize-none rounded border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 transition-colors duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-offset-slate-950"
      />
      {overLimit && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Tweet is too long — max {MAX_TWEET_LENGTH} characters
        </p>
      )}
      <div className="flex items-center justify-between">
        <span
          data-testid="composer-counter"
          className={`text-sm tabular-nums ${
            overLimit
              ? 'font-semibold text-red-600 dark:text-red-400'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {remaining}
        </span>
        <button
          type="submit"
          disabled={empty || overLimit || createTweet.isPending}
          className="flex h-9 min-w-20 cursor-pointer items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-slate-950"
        >
          {createTweet.isPending && <ArrowPathIcon className="h-4 w-4 motion-safe:animate-spin" />}
          Tweet
        </button>
      </div>
    </form>
  );
}
