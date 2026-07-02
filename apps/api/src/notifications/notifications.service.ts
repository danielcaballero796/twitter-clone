import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CursorPage,
  NotificationType,
  PublicNotification,
  UnreadCountResponse,
} from '@twitterclone/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toUserSummary, USER_SUMMARY_SELECT, type UserSummaryRow } from '../users/user-summary';

// Mirrors TWEET_INCLUDE's single-projection pattern so PublicNotification's
// actor never drifts across read sites (design D6).
const NOTIFICATION_INCLUDE = {
  actor: { select: USER_SUMMARY_SELECT },
} as const;

interface NotificationRow {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: Date;
  tweetId: string | null;
  actor: UserSummaryRow;
}

export interface CreateNotificationInput {
  type: NotificationType;
  actorId: string;
  recipientId: string;
  tweetId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Single enforcement point for the self-action rule: acting on yourself never notifies. */
  async create({ type, actorId, recipientId, tweetId }: CreateNotificationInput): Promise<void> {
    if (actorId === recipientId) {
      return;
    }
    await this.prisma.notification.create({
      data: { type, actorId, recipientId, tweetId },
    });
  }

  async removeLike(actorId: string, tweetId: string): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { type: 'LIKE', actorId, tweetId },
    });
  }

  async removeFollow(actorId: string, recipientId: string): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { type: 'FOLLOW', actorId, recipientId },
    });
  }

  async list(
    sessionUserId: string,
    { cursor, limit = 20 }: { cursor?: string; limit?: number },
  ): Promise<CursorPage<PublicNotification>> {
    // Prisma silently misbehaves on a cursor id that matches no row, so validate it up front.
    if (cursor) {
      const cursorRow = await this.prisma.notification.findUnique({
        where: { id: cursor },
        select: { id: true },
      });
      if (!cursorRow) {
        throw new BadRequestException('Invalid cursor');
      }
    }

    const rows = await this.prisma.notification.findMany({
      where: { recipientId: sessionUserId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: NOTIFICATION_INCLUDE,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const followingRows = await this.prisma.follow.findMany({
      where: {
        followerId: sessionUserId,
        followingId: { in: pageRows.map((row) => row.actor.id) },
      },
      select: { followingId: true },
    });
    const followingSet = new Set(followingRows.map((row) => row.followingId));

    const items = pageRows.map((row) => this.toPublicNotification(row, followingSet));
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  async unreadCount(sessionUserId: string): Promise<UnreadCountResponse> {
    const count = await this.prisma.notification.count({
      where: { recipientId: sessionUserId, read: false },
    });
    return { count };
  }

  async markAllRead(sessionUserId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: sessionUserId, read: false },
      data: { read: true },
    });
  }

  private toPublicNotification(
    row: NotificationRow,
    followingSet: Set<string>,
  ): PublicNotification {
    return {
      id: row.id,
      type: row.type,
      read: row.read,
      createdAt: row.createdAt.toISOString(),
      actor: toUserSummary(row.actor, followingSet),
      tweetId: row.tweetId,
    };
  }
}
