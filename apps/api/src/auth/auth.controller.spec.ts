import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('AuthController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
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

  describe('POST /auth/register', () => {
    it('returns 201 with the public user shape on valid input', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'henry@example.com',
          username: 'henry',
          password: 'supersecret',
          displayName: 'Henry',
        })
        .expect(201);

      expect(response.body).toMatchObject({ email: 'henry@example.com', username: 'henry' });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('rejects a malformed email with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          username: 'ivan',
          password: 'supersecret',
          displayName: 'Ivan',
        })
        .expect(400);
    });

    it('rejects a password shorter than 8 characters with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'jack@example.com',
          username: 'jack',
          password: 'short',
          displayName: 'Jack',
        })
        .expect(400);
    });

    it('rejects a duplicate email with 409', async () => {
      const payload = {
        email: 'kim@example.com',
        username: 'kim',
        password: 'supersecret',
        displayName: 'Kim',
      };
      await request(app.getHttpServer()).post('/auth/register').send(payload).expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...payload, username: 'kim2' })
        .expect(409);
    });

    it('rejects a duplicate username with 409', async () => {
      const payload = {
        email: 'lee@example.com',
        username: 'lee',
        password: 'supersecret',
        displayName: 'Lee',
      };
      await request(app.getHttpServer()).post('/auth/register').send(payload).expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...payload, email: 'lee2@example.com' })
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'mona@example.com',
          username: 'mona',
          password: 'correct-password',
          displayName: 'Mona',
        })
        .expect(201);
    });

    it('returns 200 and a httpOnly SameSite=Lax cookie with 7-day maxAge on success', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'mona@example.com', password: 'correct-password' })
        .expect(200);

      const cookie = response.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toContain('access_token=');
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Max-Age=604800/);
    });

    it('rejects the wrong password with 401 and no cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'mona@example.com', password: 'wrong-password' })
        .expect(401);

      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('rejects an unknown email with the same generic 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'unknown@example.com', password: 'whatever' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns 200 with the public user shape for a valid session', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/register')
        .send({
          email: 'nina@example.com',
          username: 'nina',
          password: 'correct-password',
          displayName: 'Nina',
        })
        .expect(201);
      await agent
        .post('/auth/login')
        .send({ email: 'nina@example.com', password: 'correct-password' })
        .expect(200);

      const response = await agent.get('/auth/me').expect(200);

      expect(response.body).toMatchObject({ email: 'nina@example.com', username: 'nina' });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without a session cookie', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookie and rejects subsequent protected requests', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/register')
        .send({
          email: 'oscar@example.com',
          username: 'oscar',
          password: 'correct-password',
          displayName: 'Oscar',
        })
        .expect(201);
      await agent
        .post('/auth/login')
        .send({ email: 'oscar@example.com', password: 'correct-password' })
        .expect(200);
      await agent.get('/auth/me').expect(200);

      const logoutResponse = await agent.post('/auth/logout').expect(200);
      const clearedCookie = logoutResponse.headers['set-cookie']?.[0] ?? '';
      expect(clearedCookie).toContain('access_token=;');

      await agent.get('/auth/me').expect(401);
    });
  });
});
