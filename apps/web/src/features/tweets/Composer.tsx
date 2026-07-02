import { type FormEvent, useState } from 'react';
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-b border-slate-200 pb-4">
      <label htmlFor="composer-content" className="sr-only">
        What&apos;s happening?
      </label>
      <textarea
        id="composer-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's happening?"
        rows={3}
        className="w-full resize-none rounded border border-slate-300 px-3 py-2"
      />
      {overLimit && (
        <p role="alert" className="text-sm text-red-600">
          Tweet is too long — max {MAX_TWEET_LENGTH} characters
        </p>
      )}
      <div className="flex items-center justify-between">
        <span
          data-testid="composer-counter"
          className={`text-sm ${overLimit ? 'font-semibold text-red-600' : 'text-slate-500'}`}
        >
          {remaining}
        </span>
        <button
          type="submit"
          disabled={empty || overLimit || createTweet.isPending}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Tweet
        </button>
      </div>
    </form>
  );
}
