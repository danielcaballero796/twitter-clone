import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { verify } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { seed } from '../prisma/seed';

const API_DIR = join(__dirname, '..');
const CLI_TIMEOUT_MS = 120_000;

/** Runs the real seed CLI entry (`prisma/seed.ts`) in a child process. */
function runSeedCli(envOverrides: Record<string, string>): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(
    process.execPath,
    ['--require', 'ts-node/register/transpile-only', join('prisma', 'seed.ts')],
    {
      cwd: API_DIR,
      env: { ...process.env, ...envOverrides },
      encoding: 'utf8',
      timeout: CLI_TIMEOUT_MS,
    },
  );
  if (result.error) {
    throw result.error;
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('Demo seed script (e2e)', () => {
  const prisma = new PrismaClient();

  afterEach(async () => {
    await prisma.like.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.tweet.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('inserts the fixed demo dataset and returns matching counts', async () => {
    const summary = await seed(prisma);

    expect(summary).toEqual({ users: 8, follows: 20, tweets: 45, likes: 60 });

    await expect(prisma.user.count()).resolves.toBe(8);
    await expect(prisma.follow.count()).resolves.toBe(20);
    await expect(prisma.tweet.count()).resolves.toBe(45);
    await expect(prisma.like.count()).resolves.toBe(60);
  });

  it("verifies the seeded ada user's password hash against the documented demo password", async () => {
    await seed(prisma);

    const ada = await prisma.user.findUnique({ where: { username: 'ada' } });
    expect(ada).not.toBeNull();

    await expect(verify(ada!.passwordHash, 'Flock123!')).resolves.toBe(true);
  });

  it("exercises ada's timeline depth and pagination", async () => {
    await seed(prisma);

    const ada = await prisma.user.findUnique({ where: { username: 'ada' } });
    const follows = await prisma.follow.findMany({
      where: { followerId: ada!.id },
      select: { followingId: true },
    });
    const authorIds = [...follows.map((f) => f.followingId), ada!.id];

    const timelineTweetCount = await prisma.tweet.count({
      where: { authorId: { in: authorIds } },
    });
    expect(timelineTweetCount).toBe(36);
    expect(timelineTweetCount).toBeGreaterThanOrEqual(25);

    const firstPage = await prisma.tweet.findMany({
      where: { authorId: { in: authorIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
      include: { _count: { select: { likes: true } } },
    });
    expect(firstPage).toHaveLength(20);

    const likedRows = await prisma.like.findMany({
      where: { userId: ada!.id, tweetId: { in: firstPage.map((t) => t.id) } },
      select: { tweetId: true },
    });
    const likedSet = new Set(likedRows.map((row) => row.tweetId));

    expect(firstPage.some((tweet) => likedSet.has(tweet.id))).toBe(true);
    expect(firstPage.some((tweet) => !likedSet.has(tweet.id))).toBe(true);
  });

  it('spreads likes so every tweet has between 0 and 6 likes', async () => {
    await seed(prisma);

    const tweets = await prisma.tweet.findMany({
      include: { _count: { select: { likes: true } } },
    });
    expect(tweets).toHaveLength(45);
    for (const tweet of tweets) {
      expect(tweet._count.likes).toBeGreaterThanOrEqual(0);
      expect(tweet._count.likes).toBeLessThanOrEqual(6);
    }
  });

  describe('CLI entry', () => {
    it(
      'refuses to run under NODE_ENV=production: exit 1, refusal message, no writes',
      async () => {
        // Put the database into a known state the guard must not touch.
        // Wipe first: this spec's afterEach only cleans up after its own
        // tests, so rows left behind by other processes must not leak in.
        await prisma.like.deleteMany();
        await prisma.follow.deleteMany();
        await prisma.tweet.deleteMany();
        await prisma.user.deleteMany();
        await prisma.user.create({
          data: {
            email: 'sentinel@example.com',
            username: 'sentinel',
            passwordHash: 'not-a-real-hash',
            displayName: 'Sentinel',
          },
        });

        const result = runSeedCli({
          NODE_ENV: 'production',
          DATABASE_URL: process.env.DATABASE_URL!,
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Refusing to run');

        // No deletes and no inserts: the sentinel row is the only user.
        const users = await prisma.user.findMany();
        expect(users).toHaveLength(1);
        expect(users[0].username).toBe('sentinel');
        await expect(prisma.tweet.count()).resolves.toBe(0);
      },
      CLI_TIMEOUT_MS,
    );

    it(
      'seeds the database and prints the summary counts on the happy path',
      async () => {
        const result = runSeedCli({
          NODE_ENV: 'test',
          DATABASE_URL: process.env.DATABASE_URL!,
        });

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Seed complete:');
        expect(result.stdout).toContain('users: 8');
        expect(result.stdout).toContain('follows: 20');
        expect(result.stdout).toContain('tweets: 45');
        expect(result.stdout).toContain('likes: 60');

        await expect(prisma.user.count()).resolves.toBe(8);
        await expect(prisma.follow.count()).resolves.toBe(20);
        await expect(prisma.tweet.count()).resolves.toBe(45);
        await expect(prisma.like.count()).resolves.toBe(60);
      },
      CLI_TIMEOUT_MS,
    );
  });

  it('is idempotent when run twice in a row', async () => {
    const first = await seed(prisma);
    const second = await seed(prisma);

    expect(second).toEqual(first);
    expect(second).toEqual({ users: 8, follows: 20, tweets: 45, likes: 60 });

    await expect(prisma.user.count()).resolves.toBe(8);
    await expect(prisma.follow.count()).resolves.toBe(20);
    await expect(prisma.tweet.count()).resolves.toBe(45);
    await expect(prisma.like.count()).resolves.toBe(60);
  });
});
