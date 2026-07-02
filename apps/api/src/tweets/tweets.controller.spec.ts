import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TweetsModule } from './tweets.module';

describe('TweetsController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TweetsModule, AuthModule],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.tweet.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const loggedInAgent = async (username: string): Promise<TestAgent> => {
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

  describe('POST /tweets', () => {
    it('returns 201 with the public tweet shape authored by the session user', async () => {
      const agent = await loggedInAgent('paula');

      const response = await agent.post('/tweets').send({ content: 'First tweet!' }).expect(201);

      expect(response.body).toMatchObject({
        content: 'First tweet!',
        author: { username: 'paula' },
      });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it('rejects empty content with 400 and creates nothing', async () => {
      const agent = await loggedInAgent('quinn');

      await agent.post('/tweets').send({ content: '' }).expect(400);

      await expect(prisma.tweet.count()).resolves.toBe(0);
    });

    it('rejects whitespace-only content with 400 and creates nothing', async () => {
      const agent = await loggedInAgent('rita');

      await agent.post('/tweets').send({ content: '   \n\t  ' }).expect(400);

      await expect(prisma.tweet.count()).resolves.toBe(0);
    });

    it('rejects content over 280 chars with 400 and creates nothing', async () => {
      const agent = await loggedInAgent('sam');

      await agent
        .post('/tweets')
        .send({ content: 'z'.repeat(281) })
        .expect(400);

      await expect(prisma.tweet.count()).resolves.toBe(0);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).post('/tweets').send({ content: 'nope' }).expect(401);

      await expect(prisma.tweet.count()).resolves.toBe(0);
    });
  });

  describe('DELETE /tweets/:id', () => {
    it('returns 200 and removes the tweet when the session user owns it', async () => {
      const agent = await loggedInAgent('tina');
      const created = await agent.post('/tweets').send({ content: 'bye' }).expect(201);

      await agent.delete(`/tweets/${created.body.id}`).expect(200);

      await expect(prisma.tweet.count()).resolves.toBe(0);
    });

    it("returns 403 when deleting another user's tweet", async () => {
      const author = await loggedInAgent('ursula');
      const created = await author.post('/tweets').send({ content: 'mine' }).expect(201);

      const intruder = await loggedInAgent('victor');
      await intruder.delete(`/tweets/${created.body.id}`).expect(403);

      await expect(prisma.tweet.count()).resolves.toBe(1);
    });

    it('returns 401 without a session cookie', async () => {
      await request(app.getHttpServer()).delete('/tweets/whatever').expect(401);
    });
  });

  describe('GET /tweets/timeline', () => {
    it('returns the cursor page shape with the session user own tweets', async () => {
      const agent = await loggedInAgent('wanda');
      await agent.post('/tweets').send({ content: 'my own tweet' }).expect(201);

      const response = await agent.get('/tweets/timeline').expect(200);

      expect(response.body).toMatchObject({
        items: [{ content: 'my own tweet', author: { username: 'wanda' } }],
        nextCursor: null,
        hasMore: false,
      });
    });

    it('respects the limit query param and returns a nextCursor', async () => {
      const agent = await loggedInAgent('xena');
      await agent.post('/tweets').send({ content: 'first' }).expect(201);
      await agent.post('/tweets').send({ content: 'second' }).expect(201);

      const response = await agent.get('/tweets/timeline?limit=1').expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.hasMore).toBe(true);
      expect(response.body.nextCursor).toEqual(expect.any(String));
    });

    it('rejects an out-of-range limit with 400', async () => {
      const agent = await loggedInAgent('yuri');

      await agent.get('/tweets/timeline?limit=0').expect(400);
      await agent.get('/tweets/timeline?limit=51').expect(400);
      await agent.get('/tweets/timeline?limit=abc').expect(400);
    });

    it('rejects an unknown cursor with 400', async () => {
      const agent = await loggedInAgent('zack');

      await agent.get('/tweets/timeline?cursor=not-a-real-id').expect(400);
    });

    it('returns 401 without a session cookie', async () => {
      await request(app.getHttpServer()).get('/tweets/timeline').expect(401);
    });
  });
});
