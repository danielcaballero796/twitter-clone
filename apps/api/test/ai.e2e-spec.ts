import cookieParser from 'cookie-parser';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { TEXT_GENERATOR } from '../src/ai/text-generator';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AI tweet assist (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const generate = jest.fn<Promise<string>, [string]>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // No real provider calls in tests — the seam exists exactly for this.
      .overrideProvider(TEXT_GENERATOR)
      .useValue({ generate })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(() => {
    generate.mockReset();
  });

  afterEach(async () => {
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

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .post('/ai/tweet-assist')
      .send({ text: 'launched my app today finally', action: 'improve' })
      .expect(401);
  });

  it('returns a suggestion for a valid draft and action', async () => {
    generate.mockResolvedValue('I finally launched my app today 🚀');
    const agent = await signUpAndLogin('gina');

    const response = await agent
      .post('/ai/tweet-assist')
      .send({ text: 'launched my app today finally', action: 'improve' })
      .expect(200);

    expect(response.body).toEqual({ suggestion: 'I finally launched my app today 🚀' });
    expect(generate.mock.calls[0][0]).toContain('launched my app today finally');
  });

  it('rejects drafts under the minimum length with 400', async () => {
    const agent = await signUpAndLogin('hugo');

    await agent.post('/ai/tweet-assist').send({ text: 'too short', action: 'improve' }).expect(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects unknown actions with 400', async () => {
    const agent = await signUpAndLogin('iris');

    await agent
      .post('/ai/tweet-assist')
      .send({ text: 'a perfectly long enough draft', action: 'translate' })
      .expect(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it('surfaces provider failures with the mapped status', async () => {
    const { BadGatewayException } = await import('@nestjs/common');
    generate.mockRejectedValue(new BadGatewayException('AI provider is unreachable'));
    const agent = await signUpAndLogin('jon');

    await agent
      .post('/ai/tweet-assist')
      .send({ text: 'a perfectly long enough draft', action: 'shorten' })
      .expect(502);
  });
});
