import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  private async resolveUsername(username: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
