import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import type { User } from '@prisma/client';
import type { PublicUser } from '@twitterclone/shared';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthenticatedSession {
  user: PublicUser;
  accessToken: string;
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const user = await this.usersService.create(dto);
    return this.usersService.toPublicUser(user);
  }

  async login(dto: LoginDto): Promise<AuthenticatedSession> {
    const user = await this.usersService.findByEmail(dto.email);
    // Same generic error for "no such user" and "wrong password" — avoids user enumeration.
    if (!user || !(await verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return {
      user: this.usersService.toPublicUser(user),
      accessToken: await this.signToken(user),
    };
  }

  private signToken(user: User): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, username: user.username });
  }
}
