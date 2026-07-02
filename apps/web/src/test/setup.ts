import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { resetStore } from './msw/handlers';
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

/**
 * jsdom does not implement matchMedia. This stub is configurable per-test via
 * `window.matchMedia('(prefers-color-scheme: dark)').matches = true/false` reassignment,
 * and supports addEventListener('change', ...) so theme tests can simulate live OS changes.
 */
function createMatchMediaStub() {
  // Cache one MediaQueryList per query string so every `matchMedia(query)` call within a test
  // (both the component under test and the test's own assertions) shares the same listener set.
  const cache = new Map<
    string,
    MediaQueryList & { listeners: Set<(e: MediaQueryListEvent) => void> }
  >();

  return vi.fn().mockImplementation((query: string) => {
    const cached = cache.get(query);
    if (cached) {
      return cached;
    }
    const mql: MediaQueryList & { listeners: Set<(e: MediaQueryListEvent) => void> } = {
      matches: false,
      media: query,
      onchange: null,
      listeners: new Set(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
        mql.listeners.add(listener as (e: MediaQueryListEvent) => void);
      }),
      removeEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
        mql.listeners.delete(listener as (e: MediaQueryListEvent) => void);
      }),
      dispatchEvent: vi.fn((event: Event) => {
        mql.listeners.forEach((listener) => listener(event as MediaQueryListEvent));
        return true;
      }),
    };
    cache.set(query, mql);
    return mql;
  });
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = '';
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: createMatchMediaStub(),
  });
});

afterEach(() => {
  server.resetHandlers();
  resetStore();
  window.localStorage.clear();
  document.documentElement.className = '';
});
afterAll(() => server.close());
