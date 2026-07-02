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
    await prisma.like.deleteMany();
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
        likesCount: 0,
        likedByMe: false,
        replyCount: 0,
        inReplyTo: null,
      });
      expect(new Date(tweet.createdAt).getTime()).not.toBeNaN();

      const persisted = await prisma.tweet.findUnique({ where: { id: tweet.id } });
      expect(persisted?.authorId).toBe(alice.id);
    });

    it('derives the author avatar from their stored avatar style', async () => {
      const styled = await createUser('styled');
      await prisma.user.update({ where: { id: styled.id }, data: { avatarStyle: 'thumbs' } });

      const tweet = await service.create(styled.id, 'styled tweet');

      expect(tweet.author.avatarUrl).toBe('https://api.dicebear.com/9.x/thumbs/svg?seed=styled');
    });

    it('persists 1-char and exactly 280-char content', async () => {
      const bob = await createUser('bob');

      const oneChar = await service.create(bob.id, 'x');
      const atLimit = await service.create(bob.id, 'y'.repeat(280));

      expect(oneChar.content).toBe('x');
      expect(atLimit.content).toHaveLength(280);
    });
  });

  describe('reply creation', () => {
    it('persists parentId and returns inReplyTo populated with the parent id and author username', async () => {
      const ada = await createUser('ada2');
      const parent = await service.create(ada.id, 'root tweet');

      const reply = await service.create(ada.id, 'a reply', parent.id);

      expect(reply.inReplyTo).toEqual({ id: parent.id, username: 'ada2' });
      const persisted = await prisma.tweet.findUnique({ where: { id: reply.id } });
      expect(persisted?.parentId).toBe(parent.id);
    });

    it('rejects an unknown parentId with NotFoundException and creates nothing', async () => {
      const bea = await createUser('bea2');

      await expect(
        service.create(bea.id, 'orphan reply', 'missing-parent-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(prisma.tweet.count()).resolves.toBe(0);
    });

    it('omitted parentId behaves byte-for-byte as before, with inReplyTo: null', async () => {
      const cid = await createUser('cid2');

      const tweet = await service.create(cid.id, 'top level');

      expect(tweet.inReplyTo).toBeNull();
    });

    it('allows a reply to a reply', async () => {
      const dee = await createUser('dee2');
      const root = await service.create(dee.id, 'root');
      const firstReply = await service.create(dee.id, 'first reply', root.id);

      const secondReply = await service.create(dee.id, 'reply to a reply', firstReply.id);

      expect(secondReply.inReplyTo).toEqual({ id: firstReply.id, username: 'dee2' });
    });

    it('replyCount reflects the direct-reply count on a tweet', async () => {
      const eli = await createUser('eli2');
      const root = await service.create(eli.id, 'root with replies');
      await service.create(eli.id, 'reply one', root.id);
      await service.create(eli.id, 'reply two', root.id);

      const fetched = await service.getById(eli.id, root.id);

      expect(fetched.replyCount).toBe(2);
    });
  });

  describe('getById', () => {
    it('returns 200 shape with likedByMe computed relative to the session user', async () => {
      const finn = await createUser('finn2');
      const tweet = await service.create(finn.id, 'gettable tweet');
      await prisma.like.create({ data: { userId: finn.id, tweetId: tweet.id } });

      const fetched = await service.getById(finn.id, tweet.id);

      expect(fetched).toMatchObject({ id: tweet.id, likedByMe: true });
    });

    it('rejects a nonexistent tweet id with NotFoundException', async () => {
      const gia = await createUser('gia2');

      await expect(service.getById(gia.id, 'missing-tweet-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('listReplies', () => {
    it('returns direct replies ordered createdAt asc, id asc', async () => {
      const hal = await createUser('hal2');
      const root = await prisma.tweet.create({ data: { authorId: hal.id, content: 'root' } });
      const now = Date.now();
      await prisma.tweet.create({
        data: {
          authorId: hal.id,
          content: 'reply 1',
          parentId: root.id,
          createdAt: new Date(now - 3000),
        },
      });
      await prisma.tweet.create({
        data: {
          authorId: hal.id,
          content: 'reply 2',
          parentId: root.id,
          createdAt: new Date(now - 2000),
        },
      });
      await prisma.tweet.create({
        data: {
          authorId: hal.id,
          content: 'reply 3',
          parentId: root.id,
          createdAt: new Date(now - 1000),
        },
      });

      const page = await service.listReplies(hal.id, root.id, {});

      expect(page.items.map((t) => t.content)).toEqual(['reply 1', 'reply 2', 'reply 3']);
    });

    it('returns an empty page with hasMore=false for a tweet with no replies', async () => {
      const ivy = await createUser('ivy2');
      const root = await service.create(ivy.id, 'lonely root');

      const page = await service.listReplies(ivy.id, root.id, {});

      expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
    });

    it('paginates ascending without overlap or gap', async () => {
      const jon = await createUser('jon2');
      const root = await prisma.tweet.create({ data: { authorId: jon.id, content: 'root' } });
      const now = Date.now();
      for (let i = 0; i < 3; i += 1) {
        await prisma.tweet.create({
          data: {
            authorId: jon.id,
            content: `reply ${i}`,
            parentId: root.id,
            createdAt: new Date(now - (3 - i) * 1000),
          },
        });
      }

      const first = await service.listReplies(jon.id, root.id, { limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.hasMore).toBe(true);
      expect(first.items.map((t) => t.content)).toEqual(['reply 0', 'reply 1']);

      const second = await service.listReplies(jon.id, root.id, {
        cursor: first.nextCursor!,
        limit: 2,
      });
      expect(second.items).toHaveLength(1);
      expect(second.hasMore).toBe(false);
      expect(second.items.map((t) => t.content)).toEqual(['reply 2']);
    });

    it('rejects a cursor that does not match any tweet with BadRequestException', async () => {
      const kim = await createUser('kim2');
      const root = await service.create(kim.id, 'root for bad cursor');

      await expect(
        service.listReplies(kim.id, root.id, { cursor: 'not-a-real-id' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a nonexistent parent tweet id with NotFoundException', async () => {
      const liv = await createUser('liv2');

      await expect(service.listReplies(liv.id, 'missing-parent-id', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
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

      const page = await service.listByUsername(target.id, 'ivan', {});

      expect(page.items.map((tweet) => tweet.content)).toEqual(['ivan newer', 'ivan older']);
    });

    it('paginates with working cursor: first page hasMore=true, second page has no overlap', async () => {
      const target = await createUser('karen');
      for (let i = 0; i < 3; i += 1) {
        await seedTweet(target.id, `karen tweet ${i}`, minutesAgo(10 - i));
      }

      const first = await service.listByUsername(target.id, 'karen', { limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.hasMore).toBe(true);
      expect(first).toMatchObject({ nextCursor: first.items[1].id });

      const second = await service.listByUsername(target.id, 'karen', {
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
      const leo = await createUser('leo');

      const page = await service.listByUsername(leo.id, 'leo', {});

      expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
    });

    it('rejects an unknown username with NotFoundException before running any tweet query', async () => {
      const requester = await createUser('requester');

      await expect(service.listByUsername(requester.id, 'ghost-user', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('likes enrichment', () => {
    const seedTweet = (authorId: string, content: string, createdAt: Date) =>
      prisma.tweet.create({ data: { authorId, content, createdAt } });

    const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

    const like = (userId: string, tweetId: string) =>
      prisma.like.create({ data: { userId, tweetId } });

    it('timeline items carry likesCount and likedByMe', async () => {
      const self = await createUser('mona');
      const tweet = await seedTweet(self.id, 'liked tweet', minutesAgo(1));
      await like(self.id, tweet.id);

      const page = await service.timeline(self.id, {});

      expect(page.items[0]).toMatchObject({ likesCount: 1, likedByMe: true });
    });

    it('listByUsername items carry likesCount and likedByMe', async () => {
      const author = await createUser('nate');
      const viewer = await createUser('olive');
      const tweet = await seedTweet(author.id, 'author tweet', minutesAgo(1));
      await like(viewer.id, tweet.id);

      const page = await service.listByUsername(viewer.id, 'nate', {});

      expect(page.items[0]).toMatchObject({ likesCount: 1, likedByMe: true });
    });

    it('likedByMe is session-relative: same tweet, different session users get different values', async () => {
      const author = await createUser('peter');
      const liker = await createUser('quinnie');
      const nonLiker = await createUser('rose');
      const tweet = await seedTweet(author.id, 'shared tweet', minutesAgo(1));
      await like(liker.id, tweet.id);

      const likerView = await service.listByUsername(liker.id, 'peter', {});
      const nonLikerView = await service.listByUsername(nonLiker.id, 'peter', {});

      expect(likerView.items[0]).toMatchObject({ likedByMe: true });
      expect(nonLikerView.items[0]).toMatchObject({ likedByMe: false });
    });

    it('likesCount aggregates correctly across 2 likers', async () => {
      const author = await createUser('sam2');
      const likerOne = await createUser('tina2');
      const likerTwo = await createUser('uma2');
      const tweet = await seedTweet(author.id, 'popular tweet', minutesAgo(1));
      await like(likerOne.id, tweet.id);
      await like(likerTwo.id, tweet.id);

      const page = await service.listByUsername(author.id, 'sam2', {});

      expect(page.items[0]).toMatchObject({ likesCount: 2 });
    });

    it('create() returns likesCount: 0, likedByMe: false', async () => {
      const vic = await createUser('vic2');

      const tweet = await service.create(vic.id, 'brand new');

      expect(tweet).toMatchObject({ likesCount: 0, likedByMe: false });
    });

    it('likesCount returns to 0 after like-then-unlike on subsequent fetch', async () => {
      const author = await createUser('wendy2');
      const liker = await createUser('xander2');
      const tweet = await seedTweet(author.id, 'fleeting like', minutesAgo(1));
      await like(liker.id, tweet.id);
      await prisma.like.deleteMany({ where: { userId: liker.id, tweetId: tweet.id } });

      const page = await service.listByUsername(liker.id, 'wendy2', {});

      expect(page.items[0]).toMatchObject({ likesCount: 0, likedByMe: false });
    });
  });
});
