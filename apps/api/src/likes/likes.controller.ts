import { Controller, Delete, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/types';
import { LikesService } from './likes.service';

/** The global JwtAuthGuard rejects the request before `user` can be absent. */
interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('tweets/:tweetId')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('like')
  @HttpCode(HttpStatus.OK)
  async like(
    @Req() req: AuthenticatedRequest,
    @Param('tweetId') tweetId: string,
  ): Promise<{ success: true }> {
    await this.likesService.like(req.user.sub, tweetId);
    return { success: true };
  }

  @Delete('like')
  @HttpCode(HttpStatus.OK)
  async unlike(
    @Req() req: AuthenticatedRequest,
    @Param('tweetId') tweetId: string,
  ): Promise<{ success: true }> {
    await this.likesService.unlike(req.user.sub, tweetId);
    return { success: true };
  }
}
