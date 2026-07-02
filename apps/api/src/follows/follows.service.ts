import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserListResponse, UserSummary } from '@twitterclone/shared';
import { PrismaService } from '../prisma/prisma.service';
import { avatarUrlFor } from '../users/avatar';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;

interface ListOptions {
  limit?: number;
}

interface UserRow {
  id: string;
  username: string;
  displayName: string;
  avatarStyle: string;
}

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  async follow(sessionUserId: string, targetUsername: string): Promise<void> {
    const target = await this.resolveUsername(targetUsername);
    if (target.id === sessionUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    await this.prisma.follow.createMany({
      data: [{ followerId: sessionUserId, followingId: target.id }],
      skipDuplicates: true,
    });
  }

  async unfollow(sessionUserId: string, targetUsername: string): Promise<void> {
    const target = await this.resolveUsername(targetUsername);

    await this.prisma.follow.deleteMany({
      where: { followerId: sessionUserId, followingId: target.id },
    });
  }

  async followers(
    sessionUserId: string,
    targetUsername: string,
    options: ListOptions,
  ): Promise<UserListResponse> {
    const target = await this.resolveUsername(targetUsername);
    const limit = this.resolveLimit(options.limit);

    const rows = await this.prisma.follow.findMany({
      where: { followingId: target.id },
      select: {
        follower: { select: { id: true, username: true, displayName: true, avatarStyle: true } },
      },
      take: limit,
    });

    return this.toUserListResponse(
      sessionUserId,
      rows.map((row) => row.follower),
    );
  }

  async following(
    sessionUserId: string,
    targetUsername: string,
    options: ListOptions,
  ): Promise<UserListResponse> {
    const target = await this.resolveUsername(targetUsername);
    const limit = this.resolveLimit(options.limit);

    const rows = await this.prisma.follow.findMany({
      where: { followerId: target.id },
      select: {
        following: { select: { id: true, username: true, displayName: true, avatarStyle: true } },
      },
      take: limit,
    });

    return this.toUserListResponse(
      sessionUserId,
      rows.map((row) => row.following),
    );
  }

  private async toUserListResponse(
    sessionUserId: string,
    users: UserRow[],
  ): Promise<UserListResponse> {
    const followingIds = await this.prisma.follow.findMany({
      where: { followerId: sessionUserId, followingId: { in: users.map((user) => user.id) } },
      select: { followingId: true },
    });
    const followingSet = new Set(followingIds.map((row) => row.followingId));

    return {
      items: users.map((user) => this.toUserSummary(user, followingSet)),
    };
  }

  private toUserSummary(user: UserRow, followingSet: Set<string>): UserSummary {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: avatarUrlFor(user.username, user.avatarStyle),
      isFollowing: followingSet.has(user.id),
    };
  }

  private resolveLimit(limit: number | undefined): number {
    if (limit === undefined) {
      return DEFAULT_LIST_LIMIT;
    }
    if (limit > MAX_LIST_LIMIT) {
      throw new BadRequestException('limit must not exceed 100');
    }
    return limit;
  }

  private async resolveUsername(username: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
