import { Injectable } from '@nestjs/common';
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
