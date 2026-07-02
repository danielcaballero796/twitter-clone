import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** POST follow is idempotent edge-creation, so it returns 200 like POST like does. */
const FOLLOW_SUCCESS_STATUS = 200;

describe('Follows flow (e2e)', () => {
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

  it('follow makes the target user tweets appear in the timeline, unfollow removes them', async () => {
    const a = await signUpAndLogin('followera');
    const b = await signUpAndLogin('followerb');

    await b.post('/tweets').send({ content: "b's tweet" }).expect(201);

    const beforeFollow = await a.get('/tweets/timeline').expect(200);
    expect(beforeFollow.body.items).toHaveLength(0);

    await a.post('/users/followerb/follow').expect(FOLLOW_SUCCESS_STATUS);

    const afterFollow = await a.get('/tweets/timeline').expect(200);
    expect(afterFollow.body.items).toHaveLength(1);
    expect(afterFollow.body.items[0]).toMatchObject({
      content: "b's tweet",
      author: { username: 'followerb' },
    });

    await a.delete('/users/followerb/follow').expect(200);

    const afterUnfollow = await a.get('/tweets/timeline').expect(200);
    expect(afterUnfollow.body.items).toHaveLength(0);
  });

  it('is idempotent on double-follow: no duplicate edge, no error', async () => {
    const c = await signUpAndLogin('followerc');
    await signUpAndLogin('followerd');

    await c.post('/users/followerd/follow').expect(FOLLOW_SUCCESS_STATUS);
    await c.post('/users/followerd/follow').expect(FOLLOW_SUCCESS_STATUS);

    const [cRow, dRow] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { username: 'followerc' } }),
      prisma.user.findUniqueOrThrow({ where: { username: 'followerd' } }),
    ]);
    const count = await prisma.follow.count({
      where: { followerId: cRow.id, followingId: dRow.id },
    });
    expect(count).toBe(1);
  });

  it('rejects self-follow with 400', async () => {
    const e = await signUpAndLogin('followere');

    await e.post('/users/followere/follow').expect(400);
  });

  it('rejects following an unknown username with 404', async () => {
    const f = await signUpAndLogin('followerf');

    await f.post('/users/ghost-user/follow').expect(404);
  });

  it('rejects unauthenticated follow, unfollow, lists and search with 401', async () => {
    const server = app.getHttpServer();

    await request(server).post('/users/anyone/follow').expect(401);
    await request(server).delete('/users/anyone/follow').expect(401);
    await request(server).get('/users/anyone/followers').expect(401);
    await request(server).get('/users/anyone/following').expect(401);
    await request(server).get('/users?q=anyone').expect(401);
  });

  it('returns real UserSummary lists over HTTP with session-relative isFollowing', async () => {
    const a = await signUpAndLogin('followerg');
    const b = await signUpAndLogin('followerh');

    await a.post('/users/followerh/follow').expect(FOLLOW_SUCCESS_STATUS);

    const aRow = await prisma.user.findUniqueOrThrow({ where: { username: 'followerg' } });

    const bFollowers = await b.get('/users/followerh/followers').expect(200);
    expect(bFollowers.body.items).toEqual([
      {
        id: aRow.id,
        username: 'followerg',
        displayName: 'followerg',
        avatarUrl: expect.stringContaining('followerg'),
        // B has not followed A back, so from B's own session isFollowing is false.
        isFollowing: false,
      },
    ]);

    const aFollowing = await a.get('/users/followerg/following').expect(200);
    expect(aFollowing.body.items).toMatchObject([
      {
        username: 'followerh',
        // A follows B, and A is the session user viewing their own following list.
        isFollowing: true,
      },
    ]);
  });

  it('rejects an invalid or over-max limit on the followers/following endpoints with 400', async () => {
    const i = await signUpAndLogin('followeri');
    await signUpAndLogin('followerj');

    await i.get('/users/followeri/followers?limit=abc').expect(400);
    await i.get('/users/followeri/followers?limit=101').expect(400);
    await i.get('/users/followerj/following?limit=abc').expect(400);
    await i.get('/users/followerj/following?limit=101').expect(400);
  });
});
