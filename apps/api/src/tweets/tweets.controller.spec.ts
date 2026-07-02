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
});
