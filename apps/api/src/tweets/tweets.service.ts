import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PublicTweet } from '@twitterclone/shared';
import { PrismaService } from '../prisma/prisma.service';
import { avatarUrlFor } from '../users/avatar';

const AUTHOR_SELECT = { select: { id: true, username: true, displayName: true } } as const;

interface TweetWithAuthor {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; username: string; displayName: string };
}

@Injectable()
export class TweetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, content: string): Promise<PublicTweet> {
    const tweet = await this.prisma.tweet.create({
      data: { authorId, content },
      include: { author: AUTHOR_SELECT },
    });
    return this.toPublicTweet(tweet);
  }

  async delete(userId: string, tweetId: string): Promise<void> {
    const tweet = await this.prisma.tweet.findUnique({ where: { id: tweetId } });
    if (!tweet) {
      throw new NotFoundException('Tweet not found');
    }
    if (tweet.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own tweets');
    }
    await this.prisma.tweet.delete({ where: { id: tweetId } });
  }

  toPublicTweet(tweet: TweetWithAuthor): PublicTweet {
    return {
      id: tweet.id,
      content: tweet.content,
      createdAt: tweet.createdAt.toISOString(),
      author: {
        id: tweet.author.id,
        username: tweet.author.username,
        displayName: tweet.author.displayName,
        avatarUrl: avatarUrlFor(tweet.author.username),
      },
    };
  }
}
