import cookieParser from 'cookie-parser';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ACCESS_TOKEN_COOKIE } from './cookie';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

@Controller('guard-test')
class GuardTestController {
  @Get('protected')
  protectedRoute() {
    return { ok: true };
  }

  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }
}

describe('JwtAuthGuard (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-jwt-secret', signOptions: { expiresIn: '7d' } }),
      ],
      controllers: [GuardTestController],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 for a protected route with no cookie', async () => {
    await request(app.getHttpServer()).get('/guard-test/protected').expect(401);
  });

  it('returns 401 for a protected route with a tampered token', async () => {
    const valid = await jwtService.signAsync({ sub: 'user-1', username: 'user' });
    const tampered = `${valid.slice(0, -4)}abcd`;

    await request(app.getHttpServer())
      .get('/guard-test/protected')
      .set('Cookie', [`${ACCESS_TOKEN_COOKIE}=${tampered}`])
      .expect(401);
  });

  it('returns 401 for a protected route with an expired token', async () => {
    const expired = await jwtService.signAsync(
      { sub: 'user-1', username: 'user' },
      { expiresIn: '-10s' },
    );

    await request(app.getHttpServer())
      .get('/guard-test/protected')
      .set('Cookie', [`${ACCESS_TOKEN_COOKIE}=${expired}`])
      .expect(401);
  });

  it('allows a protected route with a valid token', async () => {
    const valid = await jwtService.signAsync({ sub: 'user-1', username: 'user' });

    await request(app.getHttpServer())
      .get('/guard-test/protected')
      .set('Cookie', [`${ACCESS_TOKEN_COOKIE}=${valid}`])
      .expect(200);
  });

  it('bypasses the guard for a route decorated with @Public()', async () => {
    await request(app.getHttpServer()).get('/guard-test/public').expect(200);
  });
});
