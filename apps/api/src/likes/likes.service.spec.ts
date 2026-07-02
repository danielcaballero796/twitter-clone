import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LikesService } from './likes.service';

describe('LikesService', () => {
  let service: LikesService;
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
      providers: [LikesService, PrismaService],
    }).compile();

    service = moduleRef.get(LikesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.like.deleteMany();
    await prisma.tweet.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('like', () => {
    it('creates the like edge on first call', async () => {
      const alice = await createUser('alice');
      const bob = await createUser('bob');
      const tweet = await createTweet(bob.id, 'hello');

      await service.like(alice.id, tweet.id);

      const edge = await prisma.like.findUnique({
        where: { userId_tweetId: { userId: alice.id, tweetId: tweet.id } },
      });
      expect(edge).not.toBeNull();
    });

    it('is idempotent on re-like: no duplicate edge, no error', async () => {
      const carol = await createUser('carol');
      const dave = await createUser('dave');
      const tweet = await createTweet(dave.id, 'hello again');

      await service.like(carol.id, tweet.id);
      await expect(service.like(carol.id, tweet.id)).resolves.not.toThrow();

      const count = await prisma.like.count({ where: { userId: carol.id, tweetId: tweet.id } });
      expect(count).toBe(1);
    });

    it('rejects an unknown tweet id with NotFoundException', async () => {
      const eve = await createUser('eve');

      await expect(service.like(eve.id, 'missing-tweet-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('translates a P2003 FK violation from a tweet deleted mid-request into NotFoundException', async () => {
      const kim = await createUser('kim');
      const leo = await createUser('leo');
      const tweet = await createTweet(leo.id, 'about to be deleted');

      // Simulates the tweet being deleted by another request between resolveTweet's
      // existence check and the createMany call — Prisma surfaces this as a P2003
      // foreign key violation, which must be translated to a 404 instead of a 500.
      const createManySpy = jest.spyOn(prisma.like, 'createMany').mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
          code: 'P2003',
          clientVersion: '6.0.0',
        }),
      );

      await expect(service.like(kim.id, tweet.id)).rejects.toBeInstanceOf(NotFoundException);

      createManySpy.mockRestore();
    });
  });

  describe('unlike', () => {
    it('removes an existing like edge', async () => {
      const frank = await createUser('frank');
      const gina = await createUser('gina');
      const tweet = await createTweet(gina.id, 'hello');
      await service.like(frank.id, tweet.id);

      await service.unlike(frank.id, tweet.id);

      const edge = await prisma.like.findUnique({
        where: { userId_tweetId: { userId: frank.id, tweetId: tweet.id } },
      });
      expect(edge).toBeNull();
    });

    it('is idempotent when not liked: returns without error', async () => {
      const hank = await createUser('hank');
      const ivan = await createUser('ivan');
      const tweet = await createTweet(ivan.id, 'hello');

      await expect(service.unlike(hank.id, tweet.id)).resolves.not.toThrow();
    });

    it('rejects an unknown tweet id with NotFoundException', async () => {
      const judy = await createUser('judy');

      await expect(service.unlike(judy.id, 'missing-tweet-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
