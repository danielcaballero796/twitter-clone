import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { PublicTweet } from '@twitterclone/shared';
import type { JwtPayload } from '../auth/types';
import { CreateTweetDto } from './dto/create-tweet.dto';
import { TweetsService } from './tweets.service';

/** The global JwtAuthGuard rejects the request before `user` can be absent. */
interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('tweets')
export class TweetsController {
  constructor(private readonly tweetsService: TweetsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTweetDto): Promise<PublicTweet> {
    return this.tweetsService.create(req.user.sub, dto.content);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.tweetsService.delete(req.user.sub, id);
    return { success: true };
  }
}
