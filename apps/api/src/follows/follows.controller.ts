import { Controller, Delete, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/types';
import { FollowsService } from './follows.service';

/** The global JwtAuthGuard rejects the request before `user` can be absent. */
interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('users/:username')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post('follow')
  async follow(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
  ): Promise<{ success: true }> {
    await this.followsService.follow(req.user.sub, username);
    return { success: true };
  }

  @Delete('follow')
  @HttpCode(HttpStatus.OK)
  async unfollow(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
  ): Promise<{ success: true }> {
    await this.followsService.unfollow(req.user.sub, username);
    return { success: true };
  }
}
