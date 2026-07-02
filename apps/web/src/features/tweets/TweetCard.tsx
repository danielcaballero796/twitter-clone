import type { PublicTweet } from '@twitterclone/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
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

  const displayedLikedByMe = likeOverride?.likedByMe ?? tweet.likedByMe;
  const displayedLikesCount = likeOverride?.likesCount ?? tweet.likesCount;

  function handleDelete() {
    if (window.confirm('Delete this tweet?')) {
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
    <article className="flex gap-3 py-3">
      <img
        src={tweet.author.avatarUrl}
        alt={`${tweet.author.displayName} avatar`}
        className="h-10 w-10 shrink-0 rounded-full bg-slate-100"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-sm">
          <Link to={`/u/${tweet.author.username}`} className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">{tweet.author.displayName}</span>
            <span className="truncate text-slate-500">@{tweet.author.username}</span>
          </Link>
          <span className="text-slate-400">· {timeAgo(tweet.createdAt)}</span>
          {isOwn && (
            <button
              type="button"
              aria-label="Delete tweet"
              onClick={handleDelete}
              className="ml-auto rounded px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              ✕
            </button>
          )}
        </div>
        <p data-testid="tweet-content" className="whitespace-pre-wrap break-words text-sm">
          {tweet.content}
        </p>
        <button
          type="button"
          data-testid="tweet-like-button"
          aria-pressed={displayedLikedByMe}
          aria-label={displayedLikedByMe ? 'Unlike tweet' : 'Like tweet'}
          onClick={handleLike}
          disabled={toggleLike.isPending}
          className={`flex w-fit items-center gap-1 rounded px-2 py-1 text-xs disabled:opacity-50 ${
            displayedLikedByMe ? 'text-rose-600' : 'text-slate-500 hover:text-rose-600'
          }`}
        >
          <span aria-hidden="true">{displayedLikedByMe ? '♥' : '♡'}</span>
          <span>{displayedLikesCount}</span>
        </button>
        {likeErrored && (
          <p role="alert" className="text-xs text-red-600">
            Could not update like status. Please try again.
          </p>
        )}
      </div>
    </article>
  );
}
