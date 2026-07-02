import type { CursorPage, PublicTweet, UserListResponse, UserProfile } from '@twitterclone/shared';
import { request } from '../../lib/api';

export function searchUsers(q: string): Promise<UserListResponse> {
  const params = new URLSearchParams({ q });
  return request(`/users?${params.toString()}`, { method: 'GET' });
}

export function followUser(username: string): Promise<{ success: true }> {
  return request(`/users/${username}/follow`, { method: 'POST' });
}

export function unfollowUser(username: string): Promise<{ success: true }> {
  return request(`/users/${username}/follow`, { method: 'DELETE' });
}

export function getProfile(username: string): Promise<UserProfile> {
  return request(`/users/${username}`, { method: 'GET' });
}

export function getUserTweets(username: string, cursor?: string): Promise<CursorPage<PublicTweet>> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set('cursor', cursor);
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return request(`/users/${username}/tweets${query}`, { method: 'GET' });
}
