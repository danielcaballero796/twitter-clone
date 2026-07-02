import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth flow (e2e)', () => {
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
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, accesses a protected route, logs out, then is rejected', async () => {
    const agent = request.agent(app.getHttpServer());

    const registerResponse = await agent
      .post('/auth/register')
      .send({
        email: 'paul@example.com',
        username: 'paul',
        password: 'correct-password',
        displayName: 'Paul',
      })
      .expect(201);

    const registerCookie = registerResponse.headers['set-cookie']?.[0] ?? '';
    expect(registerCookie).toContain('access_token=');

    // Registration already established a session — /auth/me works before any explicit login.
    const meAfterRegister = await agent.get('/auth/me').expect(200);
    expect(meAfterRegister.body).toMatchObject({ email: 'paul@example.com', username: 'paul' });

    await agent
      .post('/auth/login')
      .send({ email: 'paul@example.com', password: 'correct-password' })
      .expect(200);

    const meResponse = await agent.get('/auth/me').expect(200);
    expect(meResponse.body).toMatchObject({ email: 'paul@example.com', username: 'paul' });

    await agent.post('/auth/logout').expect(200);

    await agent.get('/auth/me').expect(401);
  });

  it('rejects registration with an over-long password (argon2 cost DoS guard)', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({
        email: 'toolong@example.com',
        username: 'toolong',
        password: 'a'.repeat(73),
        displayName: 'Too Long',
      })
      .expect(400);
  });

  it('rejects registration with an over-long displayName or email', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({
        email: 'displayname@example.com',
        username: 'displayname',
        password: 'correct-password',
        displayName: 'a'.repeat(51),
      })
      .expect(400);

    await agent
      .post('/auth/register')
      .send({
        email: `${'a'.repeat(250)}@example.com`,
        username: 'longemail',
        password: 'correct-password',
        displayName: 'Long Email',
      })
      .expect(400);
  });
});
