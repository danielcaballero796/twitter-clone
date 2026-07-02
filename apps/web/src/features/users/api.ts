import type { UserListResponse } from '@twitterclone/shared';
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
