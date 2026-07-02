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
import { USER_SUMMARY_SELECT } from '../users/user-summary';

// PublicTweet's author is a TweetAuthor (no isFollowing), unlike UserSummary, so this
// reuses the shared column projection but keeps its own toPublicTweet mapper below.
const AUTHOR_SELECT = {
  select: USER_SUMMARY_SELECT,
} as const;

// Single source of truth for the projection backing PublicTweet's read sites
// (create, paginateTweets, getById, listReplies) — mirrors the USER_SUMMARY_SELECT
// pattern so replyCount/inReplyTo never drift across call sites (design D2).
const TWEET_INCLUDE = {
  author: AUTHOR_SELECT,
  _count: { select: { likes: true, replies: true } },
  parent: { select: { id: true, author: { select: { username: true } } } },
} as const;

interface TweetWithAuthor {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; username: string; displayName: string; avatarStyle: string };
  _count: { likes: number; replies: number };
  parent: { id: string; author: { username: string } } | null;
}

@Injectable()
export class TweetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, content: string, parentId?: string): Promise<PublicTweet> {
    if (parentId) {
      const parent = await this.prisma.tweet.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parent) {
        throw new NotFoundException('Parent tweet not found');
      }
    }

    const tweet = await this.prisma.tweet.create({
      data: { authorId, content, parentId },
      include: TWEET_INCLUDE,
    });
    return this.toPublicTweet(tweet, false);
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

    return this.paginateTweets(userId, { authorId: { in: authorIds } }, opts);
  }

  async listByUsername(
    sessionUserId: string,
    username: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<CursorPage<PublicTweet>> {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.paginateTweets(sessionUserId, { authorId: user.id }, opts);
  }

  async getById(sessionUserId: string, id: string): Promise<PublicTweet> {
    const tweet = await this.prisma.tweet.findUnique({
      where: { id },
      include: TWEET_INCLUDE,
    });
    if (!tweet) {
      throw new NotFoundException('Tweet not found');
    }

    const like = await this.prisma.like.findUnique({
      where: { userId_tweetId: { userId: sessionUserId, tweetId: id } },
    });

    return this.toPublicTweet(tweet, like !== null);
  }

  async listReplies(
    sessionUserId: string,
    id: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<CursorPage<PublicTweet>> {
    const parent = await this.prisma.tweet.findUnique({ where: { id }, select: { id: true } });
    if (!parent) {
      throw new NotFoundException('Tweet not found');
    }

    return this.paginateTweets(sessionUserId, { parentId: id }, { ...opts, order: 'asc' });
  }

  private async paginateTweets(
    sessionUserId: string,
    where: Prisma.TweetWhereInput,
    {
      cursor,
      limit = 20,
      order = 'desc',
    }: { cursor?: string; limit?: number; order?: 'asc' | 'desc' },
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
      orderBy: [{ createdAt: order }, { id: order }],
      include: TWEET_INCLUDE,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const likedRows = await this.prisma.like.findMany({
      where: { userId: sessionUserId, tweetId: { in: pageRows.map((tweet) => tweet.id) } },
      select: { tweetId: true },
    });
    const likedSet = new Set(likedRows.map((row) => row.tweetId));

    const items = pageRows.map((tweet) => this.toPublicTweet(tweet, likedSet.has(tweet.id)));
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  toPublicTweet(tweet: TweetWithAuthor, likedByMe: boolean): PublicTweet {
    return {
      id: tweet.id,
      content: tweet.content,
      createdAt: tweet.createdAt.toISOString(),
      author: {
        id: tweet.author.id,
        username: tweet.author.username,
        displayName: tweet.author.displayName,
        avatarUrl: avatarUrlFor(tweet.author.username, tweet.author.avatarStyle),
      },
      likesCount: tweet._count.likes,
      likedByMe,
      replyCount: tweet._count.replies,
      inReplyTo: tweet.parent
        ? { id: tweet.parent.id, username: tweet.parent.author.username }
        : null,
    };
  }
}
