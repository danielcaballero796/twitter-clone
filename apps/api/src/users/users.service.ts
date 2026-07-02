import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import type { PublicUser } from '@twitterclone/shared';
import { PrismaService } from '../prisma/prisma.service';
import { avatarUrlFor } from './avatar';

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateUserInput): Promise<User> {
    const passwordHash = await hash(input.password);

    try {
      return await this.prisma.user.create({
        data: {
          email: input.email,
          username: input.username,
          passwordHash,
          displayName: input.displayName,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        const target = (error.meta?.target as string[] | undefined) ?? [];
        const field = target.includes('email') ? 'email' : 'username';
        throw new ConflictException(`A user with that ${field} already exists`);
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: avatarUrlFor(user.username),
    };
  }
}
