import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Tweets flow (e2e)', () => {
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

  it('registers, logs in, creates a tweet and sees it in the timeline', async () => {
    const agent = await signUpAndLogin('emma');

    const created = await agent
      .post('/tweets')
      .send({ content: 'Hello from the e2e flow!' })
      .expect(201);
    expect(created.body).toMatchObject({
      content: 'Hello from the e2e flow!',
      author: { username: 'emma' },
    });

    const timeline = await agent.get('/tweets/timeline').expect(200);
    expect(timeline.body.items).toHaveLength(1);
    expect(timeline.body.items[0]).toMatchObject({
      id: created.body.id,
      content: 'Hello from the e2e flow!',
    });
  });

  it("rejects deleting another user's tweet with 403, then the owner deletes it", async () => {
    const author = await signUpAndLogin('felix');
    const created = await author.post('/tweets').send({ content: 'ownership test' }).expect(201);

    const intruder = await signUpAndLogin('greta');
    await intruder.delete(`/tweets/${created.body.id}`).expect(403);

    await author.delete(`/tweets/${created.body.id}`).expect(200);
    const timeline = await author.get('/tweets/timeline').expect(200);
    expect(timeline.body.items).toHaveLength(0);
  });

  it('paginates a followed user timeline across two pages without overlap', async () => {
    const reader = await signUpAndLogin('hilda');
    const writer = await signUpAndLogin('igor');

    for (let i = 1; i <= 3; i += 1) {
      await writer
        .post('/tweets')
        .send({ content: `tweet ${i}` })
        .expect(201);
    }

    // Follow API ships in change 04 — seed the follow edge directly.
    const [readerRow, writerRow] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { username: 'hilda' } }),
      prisma.user.findUniqueOrThrow({ where: { username: 'igor' } }),
    ]);
    await prisma.follow.create({
      data: { followerId: readerRow.id, followingId: writerRow.id },
    });

    const first = await reader.get('/tweets/timeline?limit=2').expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.hasMore).toBe(true);

    const second = await reader
      .get(`/tweets/timeline?cursor=${first.body.nextCursor}&limit=2`)
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.hasMore).toBe(false);
    expect(second.body.nextCursor).toBeNull();

    const ids = [...first.body.items, ...second.body.items].map((t: { id: string }) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('rejects unauthenticated create, delete and timeline with 401', async () => {
    const server = app.getHttpServer();

    await request(server).post('/tweets').send({ content: 'nope' }).expect(401);
    await request(server).delete('/tweets/some-id').expect(401);
    await request(server).get('/tweets/timeline').expect(401);
  });
});
