import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MAX_TWEET_LENGTH } from '@twitterclone/shared';
import { ArrowPathIcon } from '../../components/icons';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiError } from '../../lib/api';
import { useSession } from '../auth/useSession';
import TweetCard from './TweetCard';
import { useCreateReply } from './useCreateReply';
import { useDeleteTweet } from './useDeleteTweet';
import { useReplies } from './useReplies';
import { useTweet } from './useTweet';

function SkeletonRow() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
      <div className="flex flex-1 flex-col justify-center gap-2">
        <div className="h-3 w-1/3 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
        <div className="h-3 w-2/3 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
      </div>
    </div>
  );
}

interface ReplyComposerProps {
  parentId: string;
}

function ReplyComposer({ parentId }: ReplyComposerProps) {
  const [content, setContent] = useState('');
  const createReply = useCreateReply(parentId);

  const trimmedLength = content.trim().length;
  const remaining = MAX_TWEET_LENGTH - trimmedLength;
  const overLimit = remaining < 0;
  const empty = trimmedLength === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (empty || overLimit) {
      return;
    }
    createReply.mutate(content.trim(), { onSuccess: () => setContent('') });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <label htmlFor="reply-composer-content" className="sr-only">
        Post a reply
      </label>
      <textarea
        id="reply-composer-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Post your reply"
        rows={3}
        aria-invalid={overLimit}
        aria-describedby={overLimit ? 'reply-composer-error' : undefined}
        className="w-full resize-none rounded border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 transition-colors duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-offset-slate-950"
      />
      {overLimit && (
        <p
          id="reply-composer-error"
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          Reply is too long — max {MAX_TWEET_LENGTH} characters
        </p>
      )}
      <div className="flex items-center justify-between">
        <span
          data-testid="reply-composer-counter"
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
          disabled={empty || overLimit || createReply.isPending}
          className="flex min-h-11 min-w-20 cursor-pointer items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-slate-950"
        >
          {createReply.isPending && <ArrowPathIcon className="h-4 w-4 motion-safe:animate-spin" />}
          Reply
        </button>
      </div>
    </form>
  );
}

export default function ThreadPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user: sessionUser } = useSession();
  const rootTweet = useTweet(id);
  const replies = useReplies(id);
  const deleteTweet = useDeleteTweet();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = replies;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useDocumentTitle(
    rootTweet.data?.author.username
      ? `@${rootTweet.data.author.username}'s tweet / TheFlock`
      : 'Thread / TheFlock',
  );

  if (rootTweet.isLoading) {
    return (
      <div data-testid="thread-loading" role="status">
        <span className="sr-only">Loading thread…</span>
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          <SkeletonRow />
        </div>
      </div>
    );
  }

  const isNotFound = rootTweet.error instanceof ApiError && rootTweet.error.status === 404;

  if (isNotFound) {
    return (
      <p
        data-testid="thread-not-found"
        className="py-8 text-center text-sm text-slate-600 dark:text-slate-400"
      >
        Tweet not found.
      </p>
    );
  }

  if (rootTweet.isError || !rootTweet.data) {
    return (
      <p
        data-testid="thread-error"
        role="alert"
        className="py-8 text-center text-sm text-red-600 dark:text-red-400"
      >
        Could not load this thread. Please try again.
      </p>
    );
  }

  const replyTweets = replies.data?.pages.flatMap((page) => page.items) ?? [];

  function renderReplies() {
    if (replies.isLoading) {
      return (
        <div
          data-testid="replies-loading"
          role="status"
          className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="sr-only">Loading replies…</span>
          <SkeletonRow />
        </div>
      );
    }

    if (replies.isError) {
      return (
        <p
          data-testid="replies-error"
          role="alert"
          className="py-8 text-center text-sm text-red-600 dark:text-red-400"
        >
          Could not load replies. Please try again.
        </p>
      );
    }

    if (replyTweets.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {replyTweets.map((tweet) => (
            <li key={tweet.id}>
              <TweetCard
                tweet={tweet}
                sessionUserId={sessionUser?.id}
                onDelete={(deleteId) => deleteTweet.mutate(deleteId)}
              />
            </li>
          ))}
        </ul>
        <div ref={sentinelRef} data-testid="thread-replies-sentinel" aria-hidden="true" />
        {isFetchingNextPage && (
          <p
            data-testid="thread-replies-loading-more"
            role="status"
            className="py-4 text-center text-sm text-slate-600 dark:text-slate-400"
          >
            Loading more…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h2 className="sr-only">Thread</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <TweetCard
          tweet={rootTweet.data}
          sessionUserId={sessionUser?.id}
          onDelete={(deleteId) => deleteTweet.mutate(deleteId)}
        />
      </div>
      <ReplyComposer parentId={id} />
      {renderReplies()}
    </div>
  );
}
