import { useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { useSession } from '../auth/useSession';
import TweetCard from '../tweets/TweetCard';
import { useDeleteTweet } from '../tweets/useDeleteTweet';
import { useProfile } from './useProfile';
import { useToggleFollow } from './useToggleFollow';
import { useUserTweets } from './useUserTweets';

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-1/3 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
            <div className="h-3 w-1/4 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { username = '' } = useParams<{ username: string }>();
  const { user: sessionUser } = useSession();
  const profile = useProfile(username);
  const userTweets = useUserTweets(username);
  const deleteTweet = useDeleteTweet();
  const toggleFollow = useToggleFollow({
    username,
    isFollowing: profile.data?.isFollowing ?? false,
  });

  if (profile.isLoading || userTweets.isLoading) {
    return (
      <div data-testid="profile-loading">
        <ProfileSkeleton />
      </div>
    );
  }

  const isNotFound = profile.error instanceof ApiError && profile.error.status === 404;

  if (isNotFound) {
    return (
      <p
        data-testid="profile-not-found"
        className="py-8 text-center text-sm text-slate-600 dark:text-slate-400"
      >
        User not found.
      </p>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <p
        data-testid="profile-error"
        role="alert"
        className="py-8 text-center text-sm text-red-600 dark:text-red-400"
      >
        Could not load this profile. Please try again.
      </p>
    );
  }

  const isOwnProfile = sessionUser?.username === profile.data.username;
  const tweets = userTweets.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header
        data-testid="profile-header"
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-3">
          <img
            src={profile.data.avatarUrl}
            alt={`${profile.data.displayName} avatar`}
            className="h-16 w-16 shrink-0 rounded-full bg-slate-100 ring-2 ring-slate-200 dark:bg-slate-800 dark:ring-slate-800"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
              {profile.data.displayName}
            </span>
            <span className="truncate text-sm text-slate-600 dark:text-slate-400">
              @{profile.data.username}
            </span>
          </div>
          {!isOwnProfile && (
            <button
              type="button"
              onClick={() => toggleFollow.mutate()}
              disabled={toggleFollow.isPending}
              className={`h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-slate-950 ${
                profile.data.isFollowing
                  ? 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400'
              }`}
            >
              {profile.data.isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        {profile.data.bio && (
          <p data-testid="profile-bio" className="text-sm text-slate-700 dark:text-slate-300">
            {profile.data.bio}
          </p>
        )}
        <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-400">
          <span>
            <span
              data-testid="profile-followers-count"
              className="font-semibold text-slate-900 dark:text-slate-100"
            >
              {profile.data.followersCount}
            </span>{' '}
            Followers
          </span>
          <span>
            <span
              data-testid="profile-following-count"
              className="font-semibold text-slate-900 dark:text-slate-100"
            >
              {profile.data.followingCount}
            </span>{' '}
            Following
          </span>
          <span>
            <span
              data-testid="profile-tweets-count"
              className="font-semibold text-slate-900 dark:text-slate-100"
            >
              {profile.data.tweetsCount}
            </span>{' '}
            Tweets
          </span>
        </div>
        {toggleFollow.isError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            Could not update follow status. Please try again.
          </p>
        )}
      </header>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {tweets.map((tweet) => (
          <li key={tweet.id}>
            <TweetCard
              tweet={tweet}
              sessionUserId={sessionUser?.id}
              onDelete={(id) => deleteTweet.mutate(id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
