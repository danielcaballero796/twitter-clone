import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';

@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async like(userId: string, tweetId: string): Promise<void> {
    const tweet = await this.resolveTweet(tweetId);

    try {
      // createMany's count is the fan-out guard: repeat likes (and the concurrent
      // double-like race) report 0 created rows, so exactly one notification exists.
      const { count } = await this.prisma.like.createMany({
        data: [{ userId, tweetId }],
        skipDuplicates: true,
      });
      if (count > 0) {
        await this.notifications.create({
          type: 'LIKE',
          actorId: userId,
          recipientId: tweet.authorId,
          tweetId,
        });
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_FOREIGN_KEY_VIOLATION
      ) {
        throw new NotFoundException('Tweet not found');
      }
      throw error;
    }
  }

  async unlike(userId: string, tweetId: string): Promise<void> {
    await this.resolveTweet(tweetId);

    const { count } = await this.prisma.like.deleteMany({
      where: { userId, tweetId },
    });
    if (count > 0) {
      await this.notifications.removeLike(userId, tweetId);
    }
  }

  private async resolveTweet(tweetId: string): Promise<{ id: string; authorId: string }> {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId },
      select: { id: true, authorId: true },
    });
    if (!tweet) {
      throw new NotFoundException('Tweet not found');
    }
    return tweet;
  }
}
