import type { CursorPage, PublicNotification, UnreadCountResponse } from '@twitterclone/shared';
import { request } from '../../lib/api';

export function fetchNotifications(cursor?: string): Promise<CursorPage<PublicNotification>> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set('cursor', cursor);
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return request(`/notifications${query}`, { method: 'GET' });
}

export function fetchUnreadCount(): Promise<UnreadCountResponse> {
  return request('/notifications/unread-count', { method: 'GET' });
}

export function markAllRead(): Promise<{ success: true }> {
  return request('/notifications/read', { method: 'PATCH' });
}
