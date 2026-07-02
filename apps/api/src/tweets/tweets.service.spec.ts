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
});
