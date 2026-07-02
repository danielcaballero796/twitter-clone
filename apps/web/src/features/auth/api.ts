import type { LoginRequest, PublicUser, RegisterRequest } from '@twitterclone/shared';
import { request } from '../../lib/api';

export { ApiError } from '../../lib/api';

export function register(payload: RegisterRequest): Promise<PublicUser> {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export function login(payload: LoginRequest): Promise<PublicUser> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export function logout(): Promise<void> {
  return request('/auth/logout', { method: 'POST' });
}

export function fetchMe(): Promise<PublicUser> {
  return request('/auth/me', { method: 'GET' });
}
