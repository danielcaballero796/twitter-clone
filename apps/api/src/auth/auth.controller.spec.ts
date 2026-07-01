import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';

describe('AuthController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
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
        .send({ email: 'jack@example.com', username: 'jack', password: 'short', displayName: 'Jack' })
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
});
