import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TweetsService } from './tweets.service';

describe('TweetsService', () => {
  let service: TweetsService;
  let prisma: PrismaService;

  const createUser = (username: string) =>
    prisma.user.create({
      data: {
        email: `${username}@example.com`,
        username,
        passwordHash: 'irrelevant-hash',
        displayName: username,
      },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TweetsService, PrismaService],
    }).compile();

    service = moduleRef.get(TweetsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.tweet.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('persists a tweet authored by the given user and returns the public shape', async () => {
      const alice = await createUser('alice');

      const tweet = await service.create(alice.id, 'Hello world');

      expect(tweet).toEqual({
        id: expect.any(String),
        content: 'Hello world',
        createdAt: expect.any(String),
        author: {
          id: alice.id,
          username: 'alice',
          displayName: 'alice',
          avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=alice',
        },
      });
      expect(new Date(tweet.createdAt).getTime()).not.toBeNaN();

      const persisted = await prisma.tweet.findUnique({ where: { id: tweet.id } });
      expect(persisted?.authorId).toBe(alice.id);
    });

    it('persists 1-char and exactly 280-char content', async () => {
      const bob = await createUser('bob');

      const oneChar = await service.create(bob.id, 'x');
      const atLimit = await service.create(bob.id, 'y'.repeat(280));

      expect(oneChar.content).toBe('x');
      expect(atLimit.content).toHaveLength(280);
    });
  });

  describe('delete', () => {
    it('deletes the tweet when the requester is the author', async () => {
      const carol = await createUser('carol');
      const tweet = await service.create(carol.id, 'delete me');

      await service.delete(carol.id, tweet.id);

      await expect(prisma.tweet.findUnique({ where: { id: tweet.id } })).resolves.toBeNull();
    });

    it("rejects deleting another user's tweet with ForbiddenException and keeps it", async () => {
      const dave = await createUser('dave');
      const eve = await createUser('eve');
      const tweet = await service.create(dave.id, 'not yours');

      await expect(service.delete(eve.id, tweet.id)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(prisma.tweet.findUnique({ where: { id: tweet.id } })).resolves.not.toBeNull();
    });

    it('rejects a nonexistent tweet id with NotFoundException', async () => {
      const frank = await createUser('frank');

      await expect(service.delete(frank.id, 'missing-tweet-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('timeline', () => {
    const seedTweet = (authorId: string, content: string, createdAt: Date) =>
      prisma.tweet.create({ data: { authorId, content, createdAt } });

    const follow = (followerId: string, followingId: string) =>
      prisma.follow.create({ data: { followerId, followingId } });

    const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

    it('returns only own + followed tweets ordered createdAt desc', async () => {
      const self = await createUser('self');
      const followed = await createUser('followed');
      const stranger = await createUser('stranger');
      await follow(self.id, followed.id);
      await seedTweet(self.id, 'own tweet', minutesAgo(3));
      await seedTweet(followed.id, 'followed tweet', minutesAgo(1));
      await seedTweet(stranger.id, 'invisible tweet', minutesAgo(2));

      const page = await service.timeline(self.id, {});

      expect(page.items.map((t) => t.content)).toEqual(['followed tweet', 'own tweet']);
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeNull();
    });

    it('paginates without overlap or gap, even with tied createdAt across the page boundary', async () => {
      const self = await createUser('gina');
      const tied = minutesAgo(5);
      // 3 tweets share the same createdAt and straddle the limit=2 boundary.
      for (let i = 0; i < 3; i += 1) {
        await seedTweet(self.id, `tied ${i}`, tied);
      }
      await seedTweet(self.id, 'older', minutesAgo(10));

      const first = await service.timeline(self.id, { limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.hasMore).toBe(true);
      expect(first.nextCursor).toBe(first.items[1].id);

      const second = await service.timeline(self.id, { cursor: first.nextCursor!, limit: 2 });
      expect(second.items).toHaveLength(2);
      expect(second.hasMore).toBe(false);
      expect(second.nextCursor).toBeNull();

      const seenIds = [...first.items, ...second.items].map((t) => t.id);
      expect(new Set(seenIds).size).toBe(4);
    });

    it('returns an empty page with hasMore=false for a user with no tweets and no follows', async () => {
      const loner = await createUser('loner');

      const page = await service.timeline(loner.id, {});

      expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
    });

    it('rejects a cursor that does not match any tweet with BadRequestException', async () => {
      const hank = await createUser('hank');
      await seedTweet(hank.id, 'a tweet', minutesAgo(1));

      await expect(service.timeline(hank.id, { cursor: 'not-a-real-id' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('listByUsername', () => {
    const seedTweet = (authorId: string, content: string, createdAt: Date) =>
      prisma.tweet.create({ data: { authorId, content, createdAt } });

    const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

    it("returns only that user's tweets, newest-first, excluding other users' tweets", async () => {
      const target = await createUser('ivan');
      const other = await createUser('julia');
      await seedTweet(target.id, 'ivan older', minutesAgo(5));
      await seedTweet(target.id, 'ivan newer', minutesAgo(1));
      await seedTweet(other.id, 'julia tweet', minutesAgo(2));

      const page = await service.listByUsername('ivan', {});

      expect(page.items.map((tweet) => tweet.content)).toEqual(['ivan newer', 'ivan older']);
    });

    it('paginates with working cursor: first page hasMore=true, second page has no overlap', async () => {
      const target = await createUser('karen');
      for (let i = 0; i < 3; i += 1) {
        await seedTweet(target.id, `karen tweet ${i}`, minutesAgo(10 - i));
      }

      const first = await service.listByUsername('karen', { limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.hasMore).toBe(true);
      expect(first).toMatchObject({ nextCursor: first.items[1].id });

      const second = await service.listByUsername('karen', {
        cursor: first.nextCursor!,
        limit: 2,
      });
      expect(second.items).toHaveLength(1);
      expect(second.hasMore).toBe(false);
      expect(second.nextCursor).toBeNull();

      const seenIds = [...first.items, ...second.items].map((t) => t.id);
      expect(new Set(seenIds).size).toBe(3);
    });

    it('returns an empty page for a user with zero tweets', async () => {
      await createUser('leo');

      const page = await service.listByUsername('leo', {});

      expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
    });

    it('rejects an unknown username with NotFoundException before running any tweet query', async () => {
      await expect(service.listByUsername('ghost-user', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
