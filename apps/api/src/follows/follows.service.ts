import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserListResponse } from '@twitterclone/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { toUserSummary, USER_SUMMARY_SELECT, type UserSummaryRow } from '../users/user-summary';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;

interface ListOptions {
  limit?: number;
}

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async follow(sessionUserId: string, targetUsername: string): Promise<void> {
    const target = await this.resolveUsername(targetUsername);
    if (target.id === sessionUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    // createMany's count is the fan-out guard: a repeat follow reports 0 created
    // rows, so exactly one notification exists per follow edge.
    const { count } = await this.prisma.follow.createMany({
      data: [{ followerId: sessionUserId, followingId: target.id }],
      skipDuplicates: true,
    });
    if (count > 0) {
      await this.notifications.create({
        type: 'FOLLOW',
        actorId: sessionUserId,
        recipientId: target.id,
      });
    }
  }

  async unfollow(sessionUserId: string, targetUsername: string): Promise<void> {
    const target = await this.resolveUsername(targetUsername);

    const { count } = await this.prisma.follow.deleteMany({
      where: { followerId: sessionUserId, followingId: target.id },
    });
    if (count > 0) {
      await this.notifications.removeFollow(sessionUserId, target.id);
    }
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
        follower: { select: USER_SUMMARY_SELECT },
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
        following: { select: USER_SUMMARY_SELECT },
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
    users: UserSummaryRow[],
  ): Promise<UserListResponse> {
    const followingIds = await this.prisma.follow.findMany({
      where: { followerId: sessionUserId, followingId: { in: users.map((user) => user.id) } },
      select: { followingId: true },
    });
    const followingSet = new Set(followingIds.map((row) => row.followingId));

    return {
      items: users.map((user) => toUserSummary(user, followingSet)),
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
