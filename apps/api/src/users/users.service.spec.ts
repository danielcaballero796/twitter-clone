import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();

    service = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('persists a user with an argon2id password hash', async () => {
      const user = await service.create({
        email: 'alice@example.com',
        username: 'alice',
        password: 'supersecret',
        displayName: 'Alice',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('alice@example.com');
      expect(user.username).toBe('alice');
      expect(user.passwordHash).not.toBe('supersecret');
      await expect(verify(user.passwordHash, 'supersecret')).resolves.toBe(true);
    });

    it('rejects a duplicate email with ConflictException', async () => {
      await service.create({
        email: 'bob@example.com',
        username: 'bob',
        password: 'supersecret',
        displayName: 'Bob',
      });

      await expect(
        service.create({
          email: 'bob@example.com',
          username: 'bob2',
          password: 'supersecret',
          displayName: 'Bob Two',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a duplicate username with ConflictException', async () => {
      await service.create({
        email: 'carol@example.com',
        username: 'carol',
        password: 'supersecret',
        displayName: 'Carol',
      });

      await expect(
        service.create({
          email: 'carol2@example.com',
          username: 'carol',
          password: 'supersecret',
          displayName: 'Carol Two',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('lookups', () => {
    it('finds a user by email, username, and id', async () => {
      const created = await service.create({
        email: 'dave@example.com',
        username: 'dave',
        password: 'supersecret',
        displayName: 'Dave',
      });

      await expect(service.findByEmail('dave@example.com')).resolves.toMatchObject({
        id: created.id,
      });
      await expect(service.findByUsername('dave')).resolves.toMatchObject({ id: created.id });
      await expect(service.findById(created.id)).resolves.toMatchObject({ id: created.id });
      await expect(service.findByEmail('missing@example.com')).resolves.toBeNull();
    });
  });

  describe('toPublicUser', () => {
    it('maps a user to the public shape with a deterministic avatar and no password hash', async () => {
      const created = await service.create({
        email: 'erin@example.com',
        username: 'erin',
        password: 'supersecret',
        displayName: 'Erin',
      });

      const publicUser = service.toPublicUser(created);

      expect(publicUser).toEqual({
        id: created.id,
        email: 'erin@example.com',
        username: 'erin',
        displayName: 'Erin',
        bio: null,
        avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=erin',
      });
      expect(publicUser).not.toHaveProperty('passwordHash');
    });
  });

  describe('search', () => {
    const createUser = (username: string, displayName: string) =>
      service.create({
        email: `${username}@example.com`,
        username,
        password: 'supersecret',
        displayName,
      });

    it('matches by username substring', async () => {
      const self = await createUser('searcher', 'Searcher');
      const target = await createUser('johndoe', 'Someone Else');

      const result = await service.search(self.id, 'john');

      expect(result.items).toEqual([
        expect.objectContaining({ id: target.id, username: 'johndoe' }),
      ]);
    });

    it('matches by displayName substring', async () => {
      const self = await createUser('searcher2', 'Searcher Two');
      const target = await createUser('unrelated', 'John Doe');

      const result = await service.search(self.id, 'John Doe');

      expect(result.items).toEqual([
        expect.objectContaining({ id: target.id, username: 'unrelated' }),
      ]);
    });

    it('matches case-insensitively', async () => {
      const self = await createUser('searcher3', 'Searcher Three');
      const target = await createUser('JohnDoe', 'John Doe');

      const result = await service.search(self.id, 'johndoe');

      expect(result.items).toEqual([expect.objectContaining({ id: target.id })]);
    });

    it('excludes the session user even when their own name matches', async () => {
      const self = await createUser('selfmatch', 'Self Match');

      const result = await service.search(self.id, 'self');

      expect(result.items).toEqual([]);
    });

    it('caps results at 10', async () => {
      const self = await createUser('capper', 'Capper');
      for (let i = 0; i < 12; i += 1) {
        await createUser(`match${i}`, `Match User ${i}`);
      }

      const result = await service.search(self.id, 'match');

      expect(result.items).toHaveLength(10);
    });

    it('computes isFollowing true for an already-followed match', async () => {
      const self = await createUser('follower1', 'Follower One');
      const target = await createUser('followed1', 'Followed One');
      await prisma.follow.create({ data: { followerId: self.id, followingId: target.id } });

      const result = await service.search(self.id, 'followed1');

      expect(result.items).toEqual([
        expect.objectContaining({ id: target.id, isFollowing: true }),
      ]);
    });
  });
});
