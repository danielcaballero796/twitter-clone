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
