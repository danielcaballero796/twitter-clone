import { useEffect, useRef } from 'react';
import { useSession } from '../auth/useSession';
import TweetCard from './TweetCard';
import { useDeleteTweet } from './useDeleteTweet';
import { useTimeline } from './useTimeline';

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
      <p data-testid="timeline-loading" className="py-8 text-center text-sm text-slate-500">
        Loading timeline…
      </p>
    );
  }

  if (timeline.isError) {
    return (
      <p
        data-testid="timeline-error"
        role="alert"
        className="py-8 text-center text-sm text-red-600"
      >
        Could not load the timeline. Please try again.
      </p>
    );
  }

  const tweets = timeline.data?.pages.flatMap((page) => page.items) ?? [];

  if (tweets.length === 0) {
    return (
      <div data-testid="timeline-empty" className="flex flex-col items-center gap-2 py-12">
        <p className="font-semibold">Your timeline is empty</p>
        <p className="text-sm text-slate-500">Share your first tweet to get things started!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-slate-200">
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
        <p data-testid="timeline-loading-more" className="py-4 text-center text-sm text-slate-500">
          Loading more…
        </p>
      )}
    </div>
  );
}
