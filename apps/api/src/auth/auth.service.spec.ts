import { UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '7d' } })],
      providers: [AuthService, UsersService, PrismaService],
    }).compile();

    service = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);
    jwtService = moduleRef.get(JwtService);
    await prisma.$connect();
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('register', () => {
    it('creates a user and returns the public shape (no passwordHash)', async () => {
      const result = await service.register({
        email: 'frank@example.com',
        username: 'frank',
        password: 'supersecret',
        displayName: 'Frank',
      });

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('frank@example.com');
      expect(result.username).toBe('frank');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register({
        email: 'grace@example.com',
        username: 'grace',
        password: 'correct-password',
        displayName: 'Grace',
      });
    });

    it('returns a public user and a valid signed JWT on correct credentials', async () => {
      const session = await service.login({
        email: 'grace@example.com',
        password: 'correct-password',
      });

      expect(session.user.email).toBe('grace@example.com');
      const payload = await jwtService.verifyAsync<{ sub: string; username: string }>(
        session.accessToken,
      );
      expect(payload.username).toBe('grace');
    });

    it('rejects an incorrect password with UnauthorizedException', async () => {
      await expect(
        service.login({ email: 'grace@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email with the same generic UnauthorizedException', async () => {
      await expect(
        service.login({ email: 'unknown@example.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
