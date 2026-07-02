import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Likes flow (e2e)', () => {
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
    await prisma.like.deleteMany();
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

  it('supports the full like/unlike flow with counts and session-relative likedByMe', async () => {
    const a = await signUpAndLogin('likea');
    const b = await signUpAndLogin('likeb');
    const c = await signUpAndLogin('likec');

    await a.post('/users/likeb/follow').expect(200);
    const bTweet = await b.post('/tweets').send({ content: "b's tweet" }).expect(201);
    const tweetId = bTweet.body.id as string;

    await a.post(`/tweets/${tweetId}/like`).expect(200);

    const aTimeline = await a.get('/tweets/timeline').expect(200);
    expect(aTimeline.body.items).toEqual([
      expect.objectContaining({ id: tweetId, likesCount: 1, likedByMe: true }),
    ]);

    const bTweets = await b.get('/users/likeb/tweets').expect(200);
    expect(bTweets.body.items).toEqual([
      expect.objectContaining({ id: tweetId, likesCount: 1, likedByMe: false }),
    ]);

    await c.post(`/tweets/${tweetId}/like`).expect(200);
    const afterSecondLiker = await b.get('/users/likeb/tweets').expect(200);
    expect(afterSecondLiker.body.items[0]).toMatchObject({ likesCount: 2 });

    await a.post(`/tweets/${tweetId}/like`).expect(200);
    const afterDoubleLike = await b.get('/users/likeb/tweets').expect(200);
    expect(afterDoubleLike.body.items[0]).toMatchObject({ likesCount: 2 });

    await a.delete(`/tweets/${tweetId}/like`).expect(200);
    const afterUnlike = await b.get('/users/likeb/tweets').expect(200);
    expect(afterUnlike.body.items[0]).toMatchObject({ likesCount: 1 });

    await a.delete(`/tweets/${tweetId}/like`).expect(200);
    const afterSecondUnlike = await b.get('/users/likeb/tweets').expect(200);
    expect(afterSecondUnlike.body.items[0]).toMatchObject({ likesCount: 1 });
  });

  it('rejects like/unlike on an unknown tweet with 404', async () => {
    const a = await signUpAndLogin('liked');

    await a.post('/tweets/unknown-tweet-id/like').expect(404);
    await a.delete('/tweets/unknown-tweet-id/like').expect(404);
  });

  it('rejects unauthenticated like/unlike with 401', async () => {
    const server = app.getHttpServer();

    await request(server).post('/tweets/some-id/like').expect(401);
    await request(server).delete('/tweets/some-id/like').expect(401);
  });
});
