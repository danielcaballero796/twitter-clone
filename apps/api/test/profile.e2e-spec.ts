import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Profile flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.tweet.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const signUpAndLogin = async (username: string): Promise<TestAgent> => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({
        email: `${username}@example.com`,
        username,
        password: 'correct-password',
        displayName: username,
      })
      .expect(201);
    await agent
      .post('/auth/login')
      .send({ email: `${username}@example.com`, password: 'correct-password' })
      .expect(200);
    return agent;
  };

  it('supports the full profile + user-tweets flow with counts, isFollowing, and pagination', async () => {
    const a = await signUpAndLogin('profilea');
    const b = await signUpAndLogin('profileb');

    await b.post('/tweets').send({ content: 'first tweet' }).expect(201);
    await b.post('/tweets').send({ content: 'second tweet' }).expect(201);

    await a.post('/users/profileb/follow').expect(201);

    const bProfile = await a.get('/users/profileb').expect(200);
    expect(bProfile.body).toMatchObject({
      username: 'profileb',
      followersCount: 1,
      followingCount: 0,
      tweetsCount: 2,
      isFollowing: true,
    });

    const bTweets = await a.get('/users/profileb/tweets').expect(200);
    expect(bTweets.body.items.map((t: { content: string }) => t.content)).toEqual([
      'second tweet',
      'first tweet',
    ]);
    expect(
      bTweets.body.items.every(
        (t: { author: { username: string } }) => t.author.username === 'profileb',
      ),
    ).toBe(true);

    const firstPage = await a.get('/users/profileb/tweets?limit=1').expect(200);
    expect(firstPage.body.items).toHaveLength(1);
    expect(firstPage.body.hasMore).toBe(true);
    expect(firstPage.body.nextCursor).not.toBeNull();

    const secondPage = await a
      .get(`/users/profileb/tweets?limit=1&cursor=${firstPage.body.nextCursor}`)
      .expect(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.hasMore).toBe(false);
    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);

    const aOwnProfile = await a.get('/users/profilea').expect(200);
    expect(aOwnProfile.body.isFollowing).toBe(false);
  });

  describe('PATCH /users/me', () => {
    it('updates name and bio, visible on the public profile', async () => {
      const a = await signUpAndLogin('editme');

      const patch = await a
        .patch('/users/me')
        .send({ displayName: 'Edited Me', bio: 'freshly written bio' })
        .expect(200);
      expect(patch.body).toMatchObject({
        username: 'editme',
        displayName: 'Edited Me',
        bio: 'freshly written bio',
        avatarStyle: 'identicon',
      });
      expect(patch.body).not.toHaveProperty('passwordHash');

      const profile = await a.get('/users/editme').expect(200);
      expect(profile.body).toMatchObject({
        displayName: 'Edited Me',
        bio: 'freshly written bio',
      });
    });

    it('clears the bio with an empty string', async () => {
      const a = await signUpAndLogin('editclear');
      await a.patch('/users/me').send({ bio: 'temporary' }).expect(200);

      const cleared = await a.patch('/users/me').send({ bio: '' }).expect(200);

      expect(cleared.body.bio).toBeNull();
    });

    it('propagates a changed avatar style to profile, search, and timeline payloads', async () => {
      const a = await signUpAndLogin('stylea');
      const b = await signUpAndLogin('styleb');

      await b.patch('/users/me').send({ avatarStyle: 'bottts' }).expect(200);
      await b.post('/tweets').send({ content: 'styled tweet' }).expect(201);
      await a.post('/users/styleb/follow').expect(201);

      const expectedUrl = 'https://api.dicebear.com/9.x/bottts/svg?seed=styleb';
      const profile = await a.get('/users/styleb').expect(200);
      expect(profile.body.avatarUrl).toBe(expectedUrl);

      const search = await a.get('/users?q=styleb').expect(200);
      expect(search.body.items[0].avatarUrl).toBe(expectedUrl);

      const timeline = await a.get('/tweets/timeline').expect(200);
      expect(timeline.body.items[0].author.avatarUrl).toBe(expectedUrl);
    });

    it('accepts an empty patch as a no-op', async () => {
      const a = await signUpAndLogin('editnoop');

      const res = await a.patch('/users/me').send({}).expect(200);

      expect(res.body).toMatchObject({ username: 'editnoop', displayName: 'editnoop' });
    });

    it('rejects invalid payloads with 400 and stores nothing', async () => {
      const a = await signUpAndLogin('editinvalid');

      await a.patch('/users/me').send({ avatarStyle: 'not-a-style' }).expect(400);
      await a.patch('/users/me').send({ displayName: '' }).expect(400);
      await a
        .patch('/users/me')
        .send({ displayName: 'x'.repeat(51) })
        .expect(400);
      await a
        .patch('/users/me')
        .send({ bio: 'x'.repeat(161) })
        .expect(400);

      const profile = await a.get('/users/editinvalid').expect(200);
      expect(profile.body).toMatchObject({
        displayName: 'editinvalid',
        bio: null,
        avatarStyle: 'identicon',
      });
    });

    it('rejects unauthenticated updates with 401', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .send({ displayName: 'Nope' })
        .expect(401);
    });
  });

  it('rejects unknown usernames for profile and tweets with 404', async () => {
    const a = await signUpAndLogin('profilec');

    await a.get('/users/ghost-user').expect(404);
    await a.get('/users/ghost-user/tweets').expect(404);
  });

  it('rejects unauthenticated profile and tweets access with 401', async () => {
    const server = app.getHttpServer();

    await request(server).get('/users/anyone').expect(401);
    await request(server).get('/users/anyone/tweets').expect(401);
  });

  it('resolves search, followers, following, profile, and tweets routes without collision', async () => {
    const a = await signUpAndLogin('profiled');
    const b = await signUpAndLogin('profilesearchtarget');
    await b.post('/tweets').send({ content: 'coexistence tweet' }).expect(201);
    await a.post('/users/profilesearchtarget/follow').expect(201);

    const search = await a.get('/users?q=profilesearchtarget').expect(200);
    expect(search.body.items).toEqual([
      expect.objectContaining({ username: 'profilesearchtarget', isFollowing: true }),
    ]);

    const followers = await a.get('/users/profilesearchtarget/followers').expect(200);
    expect(followers.body.items).toEqual([expect.objectContaining({ username: 'profiled' })]);

    const following = await a.get('/users/profiled/following').expect(200);
    expect(following.body.items).toEqual([
      expect.objectContaining({ username: 'profilesearchtarget' }),
    ]);

    const profile = await a.get('/users/profilesearchtarget').expect(200);
    expect(profile.body).toMatchObject({ username: 'profilesearchtarget', isFollowing: true });

    const tweets = await a.get('/users/profilesearchtarget/tweets').expect(200);
    expect(tweets.body.items).toHaveLength(1);
    expect(tweets.body.items[0]).toMatchObject({ content: 'coexistence tweet' });
  });
});
