import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  async like(userId: string, tweetId: string): Promise<void> {
    await this.resolveTweet(tweetId);

    try {
      await this.prisma.like.createMany({
        data: [{ userId, tweetId }],
        skipDuplicates: true,
      });
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

    await this.prisma.like.deleteMany({
      where: { userId, tweetId },
    });
  }

  private async resolveTweet(tweetId: string): Promise<{ id: string }> {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id: tweetId },
      select: { id: true },
    });
    if (!tweet) {
      throw new NotFoundException('Tweet not found');
    }
    return tweet;
  }
}
