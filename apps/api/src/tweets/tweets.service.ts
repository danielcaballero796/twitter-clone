import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CursorPage, PublicTweet } from '@twitterclone/shared';
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

  async timeline(
    userId: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<CursorPage<PublicTweet>> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const authorIds = [...follows.map((f) => f.followingId), userId];

    return this.paginateTweets({ authorId: { in: authorIds } }, opts);
  }

  async listByUsername(
    username: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<CursorPage<PublicTweet>> {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.paginateTweets({ authorId: user.id }, opts);
  }

  private async paginateTweets(
    where: Prisma.TweetWhereInput,
    { cursor, limit = 20 }: { cursor?: string; limit?: number },
  ): Promise<CursorPage<PublicTweet>> {
    // Prisma silently misbehaves on a cursor id that matches no row, so validate it up front.
    if (cursor) {
      const cursorRow = await this.prisma.tweet.findUnique({
        where: { id: cursor },
        select: { id: true },
      });
      if (!cursorRow) {
        throw new BadRequestException('Invalid cursor');
      }
    }

    const rows = await this.prisma.tweet.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { author: AUTHOR_SELECT },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((tweet) => this.toPublicTweet(tweet));
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
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
      // TODO(block 2): compute real likesCount/likedByMe in paginateTweets/create.
      likesCount: 0,
      likedByMe: false,
    };
  }
}
