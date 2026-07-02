import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Notifications flow (e2e)', () => {
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
    await prisma.notification.deleteMany();
    await prisma.follow.deleteMany();
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

  it('rejects unauthenticated access to every notifications endpoint', async () => {
    const anonymous = request(app.getHttpServer());
    await anonymous.get('/notifications').expect(401);
    await anonymous.get('/notifications/unread-count').expect(401);
    await anonymous.patch('/notifications/read').expect(401);
  });

  it('fans out like, reply, and follow into a newest-first list with unread count', async () => {
    const alice = await signUpAndLogin('alice');
    const bob = await signUpAndLogin('bob');

    const tweet = await alice.post('/tweets').send({ content: 'notify me' }).expect(201);
    await bob.post(`/tweets/${tweet.body.id}/like`).expect(200);
    const reply = await bob
      .post('/tweets')
      .send({ content: 'a reply', parentId: tweet.body.id })
      .expect(201);
    await bob.post('/users/alice/follow').expect(200);

    const unread = await alice.get('/notifications/unread-count').expect(200);
    expect(unread.body).toEqual({ count: 3 });

    const list = await alice.get('/notifications').expect(200);
    expect(list.body.items).toHaveLength(3);
    expect(list.body.hasMore).toBe(false);
    expect(list.body.items.map((n: { type: string }) => n.type)).toEqual([
      'FOLLOW',
      'REPLY',
      'LIKE',
    ]);
    const [followItem, replyItem, likeItem] = list.body.items;
    expect(followItem.actor.username).toBe('bob');
    expect(followItem.tweetId).toBeNull();
    expect(replyItem.tweetId).toBe(reply.body.id);
    expect(likeItem.tweetId).toBe(tweet.body.id);
    expect(likeItem.read).toBe(false);

    // Bob triggered everything but receives nothing.
    const bobUnread = await bob.get('/notifications/unread-count').expect(200);
    expect(bobUnread.body).toEqual({ count: 0 });
  });

  it('marks all as read, then unlike removes its notification', async () => {
    const alice = await signUpAndLogin('carla');
    const bob = await signUpAndLogin('diego');

    const tweet = await alice.post('/tweets').send({ content: 'like then read' }).expect(201);
    await bob.post(`/tweets/${tweet.body.id}/like`).expect(200);

    await alice.patch('/notifications/read').expect(200);
    const afterRead = await alice.get('/notifications/unread-count').expect(200);
    expect(afterRead.body).toEqual({ count: 0 });
    const list = await alice.get('/notifications').expect(200);
    expect(list.body.items[0].read).toBe(true);

    await bob.delete(`/tweets/${tweet.body.id}/like`).expect(200);
    const afterUnlike = await alice.get('/notifications').expect(200);
    expect(afterUnlike.body.items).toHaveLength(0);
  });

  it('deleting the parent tweet cascades the whole notification subtree', async () => {
    const alice = await signUpAndLogin('elena');
    const bob = await signUpAndLogin('fede');

    const tweet = await alice.post('/tweets').send({ content: 'to be deleted' }).expect(201);
    await bob.post(`/tweets/${tweet.body.id}/like`).expect(200);
    await bob.post('/tweets').send({ content: 'reply', parentId: tweet.body.id }).expect(201);

    await alice.delete(`/tweets/${tweet.body.id}`).expect(200);

    // LIKE referenced the parent, REPLY referenced the reply — both cascade away.
    const list = await alice.get('/notifications').expect(200);
    expect(list.body.items).toHaveLength(0);
    const unread = await alice.get('/notifications/unread-count').expect(200);
    expect(unread.body).toEqual({ count: 0 });
  });
});
