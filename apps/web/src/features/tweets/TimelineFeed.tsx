import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import TweetCard from './TweetCard';
import { useDeleteTweet } from './useDeleteTweet';
import { useTimeline } from './useTimeline';

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

export default function TimelineFeed() {
  const { user } = useSession();
  const timeline = useTimeline();
  const deleteTweet = useDeleteTweet();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = timeline;

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

  if (timeline.isLoading) {
    return (
      <div
        data-testid="timeline-loading"
        role="status"
        className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
      >
        <span className="sr-only">Loading timeline…</span>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (timeline.isError) {
    return (
      <p
        data-testid="timeline-error"
        role="alert"
        className="py-8 text-center text-sm text-red-600 dark:text-red-400"
      >
        Could not load the timeline. Please try again.
      </p>
    );
  }

  const tweets = timeline.data?.pages.flatMap((page) => page.items) ?? [];

  if (tweets.length === 0) {
    return (
      <div
        data-testid="timeline-empty"
        className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white py-12 text-center dark:border-slate-800 dark:bg-slate-900"
      >
        <p className="font-semibold text-slate-900 dark:text-slate-100">Your timeline is empty</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No tweets yet — share your first tweet, or{' '}
          <Link
            to="/explore"
            className="cursor-pointer font-medium text-indigo-600 underline-offset-2 transition-colors duration-200 hover:underline dark:text-indigo-400"
          >
            explore people to follow
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {tweets.map((tweet) => (
          <li key={tweet.id}>
            <TweetCard
              tweet={tweet}
              sessionUserId={user?.id}
              onDelete={(id) => deleteTweet.mutate(id)}
            />
          </li>
        ))}
      </ul>
      <div ref={sentinelRef} data-testid="timeline-sentinel" aria-hidden="true" />
      {isFetchingNextPage && (
        <p
          data-testid="timeline-loading-more"
          role="status"
          className="py-4 text-center text-sm text-slate-600 dark:text-slate-400"
        >
          Loading more…
        </p>
      )}
    </div>
  );
}
