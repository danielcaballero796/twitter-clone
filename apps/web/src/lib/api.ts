const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const HTTP_NO_CONTENT = 204;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
