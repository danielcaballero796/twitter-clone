import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  async like(userId: string, tweetId: string): Promise<void> {
    await this.resolveTweet(tweetId);

    await this.prisma.like.createMany({
      data: [{ userId, tweetId }],
      skipDuplicates: true,
    });
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
