import type { PublicTweet } from '@twitterclone/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChatBubbleIcon, HeartIcon, HeartSolidIcon, TrashIcon } from '../../components/icons';
import { useToggleLike } from './useToggleLike';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function timeAgo(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  if (elapsed < MINUTE_MS) return 'now';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`;
  return new Date(iso).toLocaleDateString();
}

interface TweetCardProps {
  tweet: PublicTweet;
  sessionUserId?: string;
  onDelete: (id: string) => void;
}

interface LikeOverride {
  likedByMe: boolean;
  likesCount: number;
}

export default function TweetCard({ tweet, sessionUserId, onDelete }: TweetCardProps) {
  const isOwn = tweet.author.id === sessionUserId;
  const toggleLike = useToggleLike({ tweetId: tweet.id, likedByMe: tweet.likedByMe });
  const [likeOverride, setLikeOverride] = useState<LikeOverride | null>(null);
  const [likeErrored, setLikeErrored] = useState(false);

  // The local override only bridges until fresh like data arrives via props (cache flip or
  // refetch); once it does, server truth wins — otherwise concurrent likes would stay hidden.
  useEffect(() => {
    setLikeOverride(null);
  }, [tweet.likedByMe, tweet.likesCount]);

  const displayedLikedByMe = likeOverride?.likedByMe ?? tweet.likedByMe;
  const displayedLikesCount = likeOverride?.likesCount ?? tweet.likesCount;

  function handleDelete() {
    const confirmMessage =
      tweet.replyCount > 0
        ? `Delete this tweet and its ${tweet.replyCount} ${
            tweet.replyCount === 1 ? 'reply' : 'replies'
          }? This cannot be undone.`
        : 'Delete this tweet?';
    if (window.confirm(confirmMessage)) {
      onDelete(tweet.id);
    }
  }

  function handleLike() {
    setLikeErrored(false);
    const nextLikedByMe = !displayedLikedByMe;
    const nextLikesCount = displayedLikesCount + (nextLikedByMe ? 1 : -1);
    setLikeOverride({ likedByMe: nextLikedByMe, likesCount: nextLikesCount });

    toggleLike.mutate(undefined, {
      onError: () => {
        setLikeOverride(null);
        setLikeErrored(true);
      },
    });
  }

  return (
    <article className="flex gap-3 px-4 py-3 transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-slate-900/60">
      <img
        src={tweet.author.avatarUrl}
        alt={`${tweet.author.displayName} avatar`}
        className="h-10 w-10 shrink-0 rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-800"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-sm">
          <Link
            to={`/u/${tweet.author.username}`}
            className="flex min-w-0 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
          >
            <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
              {tweet.author.displayName}
            </span>
            <span className="truncate text-slate-600 dark:text-slate-400">
              @{tweet.author.username}
            </span>
          </Link>
          <span className="text-slate-600 dark:text-slate-400">· {timeAgo(tweet.createdAt)}</span>
          {isOwn && (
            <button
              type="button"
              aria-label="Delete tweet"
              onClick={handleDelete}
              className="ml-auto flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:focus-visible:ring-offset-slate-950"
            >
              <TrashIcon />
            </button>
          )}
        </div>
        {tweet.inReplyTo && (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Replying to{' '}
            <Link
              to={`/t/${tweet.inReplyTo.id}`}
              className="rounded font-medium text-indigo-600 underline-offset-2 transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-indigo-400 dark:focus-visible:ring-offset-slate-950"
            >
              @{tweet.inReplyTo.username}
            </Link>
          </p>
        )}
        <p
          data-testid="tweet-content"
          className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-900 dark:text-slate-100"
        >
          {tweet.content}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="tweet-like-button"
            aria-pressed={displayedLikedByMe}
            aria-label={displayedLikedByMe ? 'Unlike tweet' : 'Like tweet'}
            onClick={handleLike}
            disabled={toggleLike.isPending}
            className={`flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded px-2 text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-950 ${
              displayedLikedByMe
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400'
            }`}
          >
            {displayedLikedByMe ? (
              <HeartSolidIcon className="h-4 w-4" />
            ) : (
              <HeartIcon className="h-4 w-4" />
            )}
            <span className="tabular-nums">{displayedLikesCount}</span>
          </button>
          <Link
            to={`/t/${tweet.id}`}
            data-testid="tweet-reply-link"
            aria-label={`${tweet.replyCount} replies, open thread`}
            className="flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded px-2 text-xs text-slate-600 transition-colors duration-200 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-slate-400 dark:hover:text-indigo-400 dark:focus-visible:ring-offset-slate-950"
          >
            <ChatBubbleIcon className="h-4 w-4" />
            <span className="tabular-nums">{tweet.replyCount}</span>
          </Link>
        </div>
        {likeErrored && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            Could not update like status. Please try again.
          </p>
        )}
      </div>
    </article>
  );
}
