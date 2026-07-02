import { buildAccessTokenCookieOptions } from './cookie';

describe('buildAccessTokenCookieOptions', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('sets secure: true in production', () => {
    process.env.NODE_ENV = 'production';

    expect(buildAccessTokenCookieOptions().secure).toBe(true);
  });

  it('sets secure: false when NODE_ENV is undefined', () => {
    delete process.env.NODE_ENV;

    expect(buildAccessTokenCookieOptions().secure).toBe(false);
  });

  it('sets secure: false in test', () => {
    process.env.NODE_ENV = 'test';

    expect(buildAccessTokenCookieOptions().secure).toBe(false);
  });
});
