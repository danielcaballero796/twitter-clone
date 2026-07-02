import { ConflictException, NotFoundException } from '@nestjs/common';
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
        avatarStyle: 'identicon',
        avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=erin',
      });
      expect(publicUser).not.toHaveProperty('passwordHash');
    });

    it('derives avatarUrl from the stored avatar style, keeping the username seed', async () => {
      const created = await service.create({
        email: 'frank@example.com',
        username: 'frank',
        password: 'supersecret',
        displayName: 'Frank',
      });
      const styled = await prisma.user.update({
        where: { id: created.id },
        data: { avatarStyle: 'bottts' },
      });

      const publicUser = service.toPublicUser(styled);

      expect(publicUser.avatarStyle).toBe('bottts');
      expect(publicUser.avatarUrl).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=frank');
    });
  });

  describe('updateProfile', () => {
    const createUser = (username: string, displayName: string) =>
      service.create({
        email: `${username}@example.com`,
        username,
        password: 'supersecret',
        displayName,
      });

    it('updates only the provided fields and returns the public shape', async () => {
      const created = await createUser('editone', 'Edit One');
      await prisma.user.update({ where: { id: created.id }, data: { bio: 'original bio' } });

      const updated = await service.updateProfile(created.id, { displayName: 'Edited Name' });

      expect(updated.displayName).toBe('Edited Name');
      expect(updated.bio).toBe('original bio');
      expect(updated.avatarStyle).toBe('identicon');
      expect(updated).not.toHaveProperty('passwordHash');
    });

    it('clears the bio when given an empty string', async () => {
      const created = await createUser('edittwo', 'Edit Two');
      await prisma.user.update({ where: { id: created.id }, data: { bio: 'about to vanish' } });

      const updated = await service.updateProfile(created.id, { bio: '' });

      expect(updated.bio).toBeNull();
      const persisted = await prisma.user.findUnique({ where: { id: created.id } });
      expect(persisted?.bio).toBeNull();
    });

    it('recomputes avatarUrl when the avatar style changes', async () => {
      const created = await createUser('editthree', 'Edit Three');

      const updated = await service.updateProfile(created.id, { avatarStyle: 'bottts' });

      expect(updated.avatarStyle).toBe('bottts');
      expect(updated.avatarUrl).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=editthree');
    });

    it('treats an empty patch as a no-op', async () => {
      const created = await createUser('editfour', 'Edit Four');

      const updated = await service.updateProfile(created.id, {});

      expect(updated).toEqual(service.toPublicUser(created));
    });

    it('rejects an unknown user id with NotFoundException', async () => {
      await expect(
        service.updateProfile('missing-user-id', { displayName: 'Ghost' }),
      ).rejects.toBeInstanceOf(NotFoundException);
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

      expect(result.items).toEqual([expect.objectContaining({ id: target.id, isFollowing: true })]);
    });

    it('uses the stored avatar style in result avatars', async () => {
      const self = await createUser('styleseeker', 'Style Seeker');
      const target = await createUser('styledmatch', 'Styled Match');
      await prisma.user.update({ where: { id: target.id }, data: { avatarStyle: 'shapes' } });

      const result = await service.search(self.id, 'styledmatch');

      expect(result.items).toEqual([
        expect.objectContaining({
          avatarUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=styledmatch',
        }),
      ]);
    });
  });

  describe('profile', () => {
    const createUser = (username: string, displayName: string) =>
      service.create({
        email: `${username}@example.com`,
        username,
        password: 'supersecret',
        displayName,
      });

    it('returns all UserProfile fields', async () => {
      const self = await createUser('profileself', 'Profile Self');
      const target = await createUser('profiletarget', 'Profile Target');

      const profile = await service.profile(self.id, target.username);

      expect(profile).toEqual({
        id: target.id,
        username: 'profiletarget',
        displayName: 'Profile Target',
        bio: null,
        avatarStyle: 'identicon',
        avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=profiletarget',
        followersCount: 0,
        followingCount: 0,
        tweetsCount: 0,
        isFollowing: false,
      });
    });

    it('computes followersCount, followingCount, and tweetsCount from _count exactly', async () => {
      const self = await createUser('countsself', 'Counts Self');
      const target = await createUser('countstarget', 'Counts Target');
      const follower2 = await createUser('countsfollower2', 'Counts Follower Two');
      const followed1 = await createUser('countsfollowed1', 'Counts Followed One');
      const followed2 = await createUser('countsfollowed2', 'Counts Followed Two');

      await prisma.follow.create({ data: { followerId: self.id, followingId: target.id } });
      await prisma.follow.create({ data: { followerId: follower2.id, followingId: target.id } });
      await prisma.follow.create({ data: { followerId: target.id, followingId: followed1.id } });
      await prisma.follow.create({ data: { followerId: target.id, followingId: followed2.id } });
      await prisma.tweet.create({ data: { authorId: target.id, content: 'one' } });
      await prisma.tweet.create({ data: { authorId: target.id, content: 'two' } });
      await prisma.tweet.create({ data: { authorId: target.id, content: 'three' } });

      const profile = await service.profile(self.id, target.username);

      expect(profile.followersCount).toBe(2);
      expect(profile.followingCount).toBe(2);
      expect(profile.tweetsCount).toBe(3);
    });

    it('isFollowing is true when the session user follows the target', async () => {
      const self = await createUser('followsself', 'Follows Self');
      const target = await createUser('followstarget', 'Follows Target');
      await prisma.follow.create({ data: { followerId: self.id, followingId: target.id } });

      const profile = await service.profile(self.id, target.username);

      expect(profile.isFollowing).toBe(true);
    });

    it('isFollowing is false when the session user does not follow the target', async () => {
      const self = await createUser('notfollowself', 'Not Follow Self');
      const target = await createUser('notfollowtarget', 'Not Follow Target');

      const profile = await service.profile(self.id, target.username);

      expect(profile.isFollowing).toBe(false);
    });

    it('isFollowing is false on own profile', async () => {
      const self = await createUser('ownprofile', 'Own Profile');

      const profile = await service.profile(self.id, self.username);

      expect(profile.isFollowing).toBe(false);
    });

    it('derives the profile avatar from the stored style', async () => {
      const self = await createUser('profstyleself', 'Prof Style Self');
      const target = await createUser('profstyletarget', 'Prof Style Target');
      await prisma.user.update({ where: { id: target.id }, data: { avatarStyle: 'pixel-art' } });

      const profile = await service.profile(self.id, target.username);

      expect(profile.avatarStyle).toBe('pixel-art');
      expect(profile.avatarUrl).toBe(
        'https://api.dicebear.com/9.x/pixel-art/svg?seed=profstyletarget',
      );
    });

    it('rejects an unknown username with NotFoundException', async () => {
      const self = await createUser('unknownlookup', 'Unknown Lookup');

      await expect(service.profile(self.id, 'ghost-user')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
