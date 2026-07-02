import { useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { useSession } from '../auth/useSession';
import TweetCard from '../tweets/TweetCard';
import { useDeleteTweet } from '../tweets/useDeleteTweet';
import { useProfile } from './useProfile';
import { useToggleFollow } from './useToggleFollow';
import { useUserTweets } from './useUserTweets';

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
      <p data-testid="profile-loading" className="py-8 text-center text-sm text-slate-500">
        Loading profile…
      </p>
    );
  }

  const isNotFound = profile.error instanceof ApiError && profile.error.status === 404;

  if (isNotFound) {
    return (
      <p data-testid="profile-not-found" className="py-8 text-center text-sm text-slate-500">
        User not found.
      </p>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <p data-testid="profile-error" role="alert" className="py-8 text-center text-sm text-red-600">
        Could not load this profile. Please try again.
      </p>
    );
  }

  const isOwnProfile = sessionUser?.username === profile.data.username;
  const tweets = userTweets.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header data-testid="profile-header" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <img
            src={profile.data.avatarUrl}
            alt={`${profile.data.displayName} avatar`}
            className="h-16 w-16 shrink-0 rounded-full bg-slate-100"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-lg font-bold">{profile.data.displayName}</span>
            <span className="truncate text-sm text-slate-500">@{profile.data.username}</span>
          </div>
          {!isOwnProfile && (
            <button
              type="button"
              onClick={() => toggleFollow.mutate()}
              disabled={toggleFollow.isPending}
              className="shrink-0 rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {profile.data.isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        {profile.data.bio && (
          <p data-testid="profile-bio" className="text-sm text-slate-700">
            {profile.data.bio}
          </p>
        )}
        <div className="flex gap-4 text-sm text-slate-600">
          <span>
            <span data-testid="profile-followers-count" className="font-semibold text-slate-900">
              {profile.data.followersCount}
            </span>{' '}
            Followers
          </span>
          <span>
            <span data-testid="profile-following-count" className="font-semibold text-slate-900">
              {profile.data.followingCount}
            </span>{' '}
            Following
          </span>
          <span>
            <span data-testid="profile-tweets-count" className="font-semibold text-slate-900">
              {profile.data.tweetsCount}
            </span>{' '}
            Tweets
          </span>
        </div>
        {toggleFollow.isError && (
          <p role="alert" className="text-xs text-red-600">
            Could not update follow status. Please try again.
          </p>
        )}
      </header>
      <ul className="divide-y divide-slate-200">
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
