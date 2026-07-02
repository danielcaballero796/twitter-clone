import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TweetsController } from './tweets.controller';
import { TweetsService } from './tweets.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TweetsController],
  providers: [TweetsService],
  exports: [TweetsService],
})
export class TweetsModule {}
