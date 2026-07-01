import type { LoginRequest, PublicUser, RegisterRequest } from '@twitterclone/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : 'Request failed';
    throw new ApiError(response.status, message);
  }

  if (response.status === HTTP_NO_CONTENT) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

const HTTP_NO_CONTENT = 204;

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
