import { http, HttpResponse } from 'msw';

export const API_URL = 'http://localhost:3000';

/** Default handlers — an unauthenticated session unless a test overrides them. */
export const handlers = [
  http.get(`${API_URL}/auth/me`, () => new HttpResponse(null, { status: 401 })),
];
