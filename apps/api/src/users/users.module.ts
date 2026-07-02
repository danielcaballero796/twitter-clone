import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TweetsModule } from '../tweets/tweets.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, TweetsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
