import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { PublicNotification } from '@twitterclone/shared';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useMarkRead } from './useMarkRead';
import { useNotifications } from './useNotifications';

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

const ACTION_LABEL: Record<PublicNotification['type'], string> = {
  LIKE: 'liked your tweet',
  REPLY: 'replied to your tweet',
  FOLLOW: 'followed you',
};

function notificationTarget(notification: PublicNotification): string {
  if (notification.type === 'FOLLOW' || notification.tweetId === null) {
    return `/u/${notification.actor.username}`;
  }
  return `/t/${notification.tweetId}`;
}

function NotificationRow({ notification }: { notification: PublicNotification }) {
  return (
    <Link
      to={notificationTarget(notification)}
      className="flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:hover:bg-slate-800/50"
    >
      <img
        src={notification.actor.avatarUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800"
      />
      <p className="min-w-0 flex-1 text-[15px] text-slate-900 dark:text-slate-100">
        <span className="font-semibold">{notification.actor.displayName}</span>{' '}
        <span className="text-slate-600 dark:text-slate-400">@{notification.actor.username}</span>{' '}
        {ACTION_LABEL[notification.type]}
      </p>
      {!notification.read && (
        <span
          data-testid="notification-unread-dot"
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400"
        />
      )}
    </Link>
  );
}

export default function NotificationsPage() {
  const notifications = useNotifications();
  const { mutate: markAllRead } = useMarkRead();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useDocumentTitle('Notifications / TheFlock');

  // Visiting the page is what marks everything read (spec: mark-read on visit).
  // `mutate` is referentially stable in TanStack Query v5, so this fires once.
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = notifications;

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

  if (notifications.isLoading) {
    return (
      <div data-testid="notifications-loading" role="status">
        <span className="sr-only">Loading notifications…</span>
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (notifications.isError) {
    return (
      <div data-testid="notifications-error" role="alert" className="py-8 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">
          Could not load notifications. Please try again.
        </p>
        <button
          type="button"
          onClick={() => void notifications.refetch()}
          className="mt-3 min-h-11 cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Retry
        </button>
      </div>
    );
  }

  const items = notifications.data?.pages.flatMap((page) => page.items) ?? [];

  if (items.length === 0) {
    return (
      <p
        data-testid="notifications-empty"
        className="py-8 text-center text-sm text-slate-600 dark:text-slate-400"
      >
        Nothing here yet — when someone likes, replies to, or follows you, it shows up here.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h2 className="sr-only">Notifications</h2>
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {items.map((notification) => (
            <li key={notification.id}>
              <NotificationRow notification={notification} />
            </li>
          ))}
        </ul>
        <div ref={sentinelRef} data-testid="notifications-sentinel" aria-hidden="true" />
        {isFetchingNextPage && (
          <p
            data-testid="notifications-loading-more"
            role="status"
            className="py-4 text-center text-sm text-slate-600 dark:text-slate-400"
          >
            Loading more…
          </p>
        )}
      </div>
    </div>
  );
}
