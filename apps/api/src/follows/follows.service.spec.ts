import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FollowsService } from './follows.service';

describe('FollowsService', () => {
  let service: FollowsService;
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
      providers: [FollowsService, PrismaService],
    }).compile();

    service = moduleRef.get(FollowsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.follow.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('follow', () => {
    it('creates a follow edge from the session user to the target username', async () => {
      const alice = await createUser('alice');
      const bob = await createUser('bob');

      await service.follow(alice.id, 'bob');

      const edge = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: alice.id, followingId: bob.id } },
      });
      expect(edge).not.toBeNull();
    });

    it('is idempotent on re-follow: no duplicate, no error', async () => {
      const carol = await createUser('carol');
      await createUser('dave');

      await service.follow(carol.id, 'dave');
      await expect(service.follow(carol.id, 'dave')).resolves.not.toThrow();

      const count = await prisma.follow.count({ where: { followerId: carol.id } });
      expect(count).toBe(1);
    });

    it('rejects self-follow with BadRequestException and creates no edge', async () => {
      const eve = await createUser('eve');

      await expect(service.follow(eve.id, 'eve')).rejects.toBeInstanceOf(BadRequestException);
      await expect(prisma.follow.count()).resolves.toBe(0);
    });

    it('rejects an unknown target username with NotFoundException', async () => {
      const frank = await createUser('frank');

      await expect(service.follow(frank.id, 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('unfollow', () => {
    it('removes an existing follow edge', async () => {
      const gina = await createUser('gina');
      const hank = await createUser('hank');
      await service.follow(gina.id, 'hank');

      await service.unfollow(gina.id, 'hank');

      const edge = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: gina.id, followingId: hank.id } },
      });
      expect(edge).toBeNull();
    });

    it('is idempotent when not following: returns without error', async () => {
      const ivan = await createUser('ivan');
      await createUser('judy');

      await expect(service.unfollow(ivan.id, 'judy')).resolves.not.toThrow();
    });

    it('rejects an unknown target username with NotFoundException', async () => {
      const kim = await createUser('kim');

      await expect(service.unfollow(kim.id, 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('followers', () => {
    it('returns a UserSummary[] of the target username followers', async () => {
      const laura = await createUser('laura');
      const marco = await createUser('marco');
      await service.follow(marco.id, 'laura');

      const page = await service.followers(laura.id, 'laura', {});

      expect(page.items).toEqual([
        {
          id: marco.id,
          username: 'marco',
          displayName: 'marco',
          avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=marco',
          isFollowing: false,
        },
      ]);
    });

    it('defaults to a limit of 50 and rejects a limit above 100', async () => {
      const nina = await createUser('nina');

      const page = await service.followers(nina.id, 'nina', {});
      expect(page.items).toEqual([]);

      await expect(service.followers(nina.id, 'nina', { limit: 101 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('computes isFollowing relative to the session user, not the target', async () => {
      const oscar = await createUser('oscar');
      const paul = await createUser('paul');
      await createUser('target');
      await service.follow(paul.id, 'target');
      await service.follow(oscar.id, 'paul');

      const page = await service.followers(oscar.id, 'target', {});

      expect(page.items).toEqual([
        {
          id: paul.id,
          username: 'paul',
          displayName: 'paul',
          avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=paul',
          isFollowing: true,
        },
      ]);
    });

    it('rejects an unknown target username with NotFoundException', async () => {
      const quinn = await createUser('quinn');

      await expect(service.followers(quinn.id, 'ghost', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('following', () => {
    it('returns a UserSummary[] of accounts the target username follows', async () => {
      const rachel = await createUser('rachel');
      const sam = await createUser('sam');
      await service.follow(rachel.id, 'sam');

      const page = await service.following(rachel.id, 'rachel', {});

      expect(page.items).toEqual([
        {
          id: sam.id,
          username: 'sam',
          displayName: 'sam',
          avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=sam',
          isFollowing: true,
        },
      ]);
    });

    it('rejects an unknown target username with NotFoundException', async () => {
      const tara = await createUser('tara');

      await expect(service.following(tara.id, 'ghost', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
