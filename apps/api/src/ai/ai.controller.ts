import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { TweetAssistResponse } from '@twitterclone/shared';
import { AiService } from './ai.service';
import { TweetAssistDto } from './dto/tweet-assist.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // 200, not 201: assistance computes a suggestion, it creates no resource.
  @Post('tweet-assist')
  @HttpCode(HttpStatus.OK)
  async tweetAssist(@Body() dto: TweetAssistDto): Promise<TweetAssistResponse> {
    return this.aiService.tweetAssist(dto.action, dto.text);
  }
}
