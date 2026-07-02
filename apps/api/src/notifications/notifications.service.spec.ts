import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
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

  const createTweet = (authorId: string, content: string) =>
    prisma.tweet.create({ data: { authorId, content } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [NotificationsService, PrismaService],
    }).compile();

    service = moduleRef.get(NotificationsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.tweet.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('persists a notification for the recipient', async () => {
      const alice = await createUser('alice');
      const bob = await createUser('bob');
      const tweet = await createTweet(alice.id, 'hello');

      await service.create({
        type: 'LIKE',
        actorId: bob.id,
        recipientId: alice.id,
        tweetId: tweet.id,
      });

      const rows = await prisma.notification.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: 'LIKE',
        actorId: bob.id,
        recipientId: alice.id,
        tweetId: tweet.id,
        read: false,
      });
    });

    it('skips self-actions entirely', async () => {
      const alice = await createUser('alice');
      const tweet = await createTweet(alice.id, 'hello');

      await service.create({
        type: 'LIKE',
        actorId: alice.id,
        recipientId: alice.id,
        tweetId: tweet.id,
      });

      expect(await prisma.notification.count()).toBe(0);
    });
  });

  describe('list', () => {
    it('returns only the session user notifications, newest first', async () => {
      const alice = await createUser('alice');
      const bob = await createUser('bob');
      const carol = await createUser('carol');
      const tweet = await createTweet(alice.id, 'hello');

      await prisma.notification.create({
        data: {
          type: 'LIKE',
          actorId: bob.id,
          recipientId: alice.id,
          tweetId: tweet.id,
          createdAt: new Date('2026-07-01T10:00:00Z'),
        },
      });
      await prisma.notification.create({
        data: {
          type: 'FOLLOW',
          actorId: carol.id,
          recipientId: alice.id,
          createdAt: new Date('2026-07-01T11:00:00Z'),
        },
      });
      await prisma.notification.create({
        data: { type: 'FOLLOW', actorId: alice.id, recipientId: bob.id },
      });

      const page = await service.list(alice.id, {});

      expect(page.items).toHaveLength(2);
      expect(page.items[0].type).toBe('FOLLOW');
      expect(page.items[0].actor.username).toBe('carol');
      expect(page.items[0].tweetId).toBeNull();
      expect(page.items[1].type).toBe('LIKE');
      expect(page.items[1].actor.username).toBe('bob');
      expect(page.items[1].tweetId).toBe(tweet.id);
      expect(page.hasMore).toBe(false);
    });

    it('paginates with cursor semantics and no overlap', async () => {
      const alice = await createUser('alice');
      const bob = await createUser('bob');
      for (let i = 0; i < 5; i += 1) {
        await prisma.notification.create({
          data: {
            type: 'FOLLOW',
            actorId: bob.id,
            recipientId: alice.id,
            createdAt: new Date(Date.UTC(2026, 6, 1, 10, i)),
          },
        });
      }

      const first = await service.list(alice.id, { limit: 3 });
      expect(first.items).toHaveLength(3);
      expect(first.hasMore).toBe(true);

      const second = await service.list(alice.id, {
        limit: 3,
        cursor: first.nextCursor ?? undefined,
      });
      expect(second.items).toHaveLength(2);
      expect(second.hasMore).toBe(false);
      const ids = [...first.items, ...second.items].map((n) => n.id);
      expect(new Set(ids).size).toBe(5);
    });

    it('rejects an invalid cursor with BadRequestException', async () => {
      const alice = await createUser('alice');

      await expect(service.list(alice.id, { cursor: 'garbage' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('unreadCount', () => {
    it('counts unread only', async () => {
      const alice = await createUser('alice');
      const bob = await createUser('bob');
      await prisma.notification.create({
        data: { type: 'FOLLOW', actorId: bob.id, recipientId: alice.id },
      });
      await prisma.notification.create({
        data: { type: 'FOLLOW', actorId: bob.id, recipientId: alice.id, read: true },
      });

      expect(await service.unreadCount(alice.id)).toEqual({ count: 1 });
    });

    it('returns zero when everything is read', async () => {
      const alice = await createUser('alice');

      expect(await service.unreadCount(alice.id)).toEqual({ count: 0 });
    });
  });

  describe('markAllRead', () => {
    it('marks only the session user notifications as read', async () => {
      const alice = await createUser('alice');
      const bob = await createUser('bob');
      await prisma.notification.create({
        data: { type: 'FOLLOW', actorId: bob.id, recipientId: alice.id },
      });
      await prisma.notification.create({
        data: { type: 'FOLLOW', actorId: alice.id, recipientId: bob.id },
      });

      await service.markAllRead(alice.id);

      expect(await service.unreadCount(alice.id)).toEqual({ count: 0 });
      expect(await service.unreadCount(bob.id)).toEqual({ count: 1 });
    });

    it('is idempotent when nothing is unread', async () => {
      const alice = await createUser('alice');

      await expect(service.markAllRead(alice.id)).resolves.not.toThrow();
      await expect(service.markAllRead(alice.id)).resolves.not.toThrow();
    });
  });

  describe('removeLike / removeFollow', () => {
    it('removes the LIKE notification for that actor and tweet', async () => {
      const alice = await createUser('alice');
      const bob = await createUser('bob');
      const tweet = await createTweet(alice.id, 'hello');
      await prisma.notification.create({
        data: { type: 'LIKE', actorId: bob.id, recipientId: alice.id, tweetId: tweet.id },
      });

      await service.removeLike(bob.id, tweet.id);

      expect(await prisma.notification.count()).toBe(0);
    });

    it('removes the FOLLOW notification for that actor and recipient', async () => {
      const alice = await createUser('alice');
      const bob = await createUser('bob');
      await prisma.notification.create({
        data: { type: 'FOLLOW', actorId: bob.id, recipientId: alice.id },
      });

      await service.removeFollow(bob.id, alice.id);

      expect(await prisma.notification.count()).toBe(0);
    });
  });
});
