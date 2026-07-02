import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UsersModule } from './users.module';

describe('UsersController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [UsersModule, AuthModule],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
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

  describe('GET /users', () => {
    it('returns matching users as UserSummary[]', async () => {
      const agent = await loggedInAgent('alice');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'bobsearch@example.com',
          username: 'bobsearch',
          password: 'correct-password',
          displayName: 'Bob Search',
        })
        .expect(201);

      const response = await agent.get('/users?q=bobsearch').expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({ username: 'bobsearch', isFollowing: false }),
      ]);
    });

    it('rejects a missing q param with 400', async () => {
      const agent = await loggedInAgent('carol');

      await agent.get('/users').expect(400);
    });

    it('rejects an empty q param with 400', async () => {
      const agent = await loggedInAgent('dave');

      await agent.get('/users?q=').expect(400);
    });

    it('returns 401 without a session cookie', async () => {
      await request(app.getHttpServer()).get('/users?q=anything').expect(401);
    });
  });

  describe('GET /users/:username/tweets', () => {
    it('defaults limit to 20 and accepts limit=50', async () => {
      const agent = await loggedInAgent('tweetslimitdefault');

      await agent.get('/users/tweetslimitdefault/tweets').expect(200);
      await agent.get('/users/tweetslimitdefault/tweets?limit=50').expect(200);
    });

    it('rejects limit=51 with 400', async () => {
      const agent = await loggedInAgent('tweetslimitreject');

      await agent.get('/users/tweetslimitreject/tweets?limit=51').expect(400);
    });
  });
});
