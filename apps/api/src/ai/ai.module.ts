import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiClient } from './gemini.client';
import { TEXT_GENERATOR } from './text-generator';

@Module({
  controllers: [AiController],
  providers: [AiService, { provide: TEXT_GENERATOR, useClass: GeminiClient }],
})
export class AiModule {}
