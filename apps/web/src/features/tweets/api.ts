import type { CreateTweetRequest, CursorPage, PublicTweet } from '@twitterclone/shared';
import { request } from '../../lib/api';

export function fetchTimeline(cursor?: string): Promise<CursorPage<PublicTweet>> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set('cursor', cursor);
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return request(`/tweets/timeline${query}`, { method: 'GET' });
}

export function createTweet(payload: CreateTweetRequest): Promise<PublicTweet> {
  return request('/tweets', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchTweet(id: string): Promise<PublicTweet> {
  return request(`/tweets/${id}`, { method: 'GET' });
}

export function fetchReplies(id: string, cursor?: string): Promise<CursorPage<PublicTweet>> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set('cursor', cursor);
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return request(`/tweets/${id}/replies${query}`, { method: 'GET' });
}

export function deleteTweet(id: string): Promise<{ success: true }> {
  return request(`/tweets/${id}`, { method: 'DELETE' });
}

export function likeTweet(tweetId: string): Promise<{ success: true }> {
  return request(`/tweets/${tweetId}/like`, { method: 'POST' });
}

export function unlikeTweet(tweetId: string): Promise<{ success: true }> {
  return request(`/tweets/${tweetId}/like`, { method: 'DELETE' });
}
