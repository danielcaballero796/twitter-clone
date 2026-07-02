import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import type { PublicUser, UserListResponse, UserProfile } from '@twitterclone/shared';
import { PrismaService } from '../prisma/prisma.service';
import { avatarUrlFor } from './avatar';

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const SEARCH_RESULT_CAP = 10;

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

  async search(sessionUserId: string, q: string): Promise<UserListResponse> {
    const matches = await this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
        NOT: { id: sessionUserId },
      },
      select: { id: true, username: true, displayName: true },
      take: SEARCH_RESULT_CAP,
    });

    const followingRows = await this.prisma.follow.findMany({
      where: {
        followerId: sessionUserId,
        followingId: { in: matches.map((user) => user.id) },
      },
      select: { followingId: true },
    });
    const followingSet = new Set(followingRows.map((row) => row.followingId));

    return {
      items: matches.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: avatarUrlFor(user.username),
        isFollowing: followingSet.has(user.id),
      })),
    };
  }

  async profile(sessionUserId: string, username: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { _count: { select: { followers: true, following: true, tweets: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isFollowing =
      sessionUserId === user.id
        ? false
        : (await this.prisma.follow.findUnique({
            where: {
              followerId_followingId: { followerId: sessionUserId, followingId: user.id },
            },
          })) !== null;

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: avatarUrlFor(user.username),
      followersCount: user._count.followers,
      followingCount: user._count.following,
      tweetsCount: user._count.tweets,
      isFollowing,
    };
  }
}
