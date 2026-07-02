import type { PublicTweet } from '@twitterclone/shared';
import { Link } from 'react-router-dom';

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

export default function TweetCard({ tweet, sessionUserId, onDelete }: TweetCardProps) {
  const isOwn = tweet.author.id === sessionUserId;

  function handleDelete() {
    if (window.confirm('Delete this tweet?')) {
      onDelete(tweet.id);
    }
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
      </div>
    </article>
  );
}
