import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type {
  CursorPage,
  PublicTweet,
  PublicUser,
  UserListResponse,
  UserProfile,
} from '@twitterclone/shared';
import type { JwtPayload } from '../auth/types';
import { TimelineQueryDto } from '../tweets/dto/timeline-query.dto';
import { TweetsService } from '../tweets/tweets.service';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

/** The global JwtAuthGuard rejects the request before `user` can be absent. */
interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tweetsService: TweetsService,
  ) {}

  @Get()
  search(
    @Req() req: AuthenticatedRequest,
    @Query() query: SearchUsersDto,
  ): Promise<UserListResponse> {
    return this.usersService.search(req.user.sub, query.q);
  }

  @Patch('me')
  updateMe(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto): Promise<PublicUser> {
    return this.usersService.updateProfile(req.user.sub, dto);
  }

  @Get(':username/tweets')
  tweets(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
    @Query() query: TimelineQueryDto,
  ): Promise<CursorPage<PublicTweet>> {
    return this.tweetsService.listByUsername(req.user.sub, username, query);
  }

  @Get(':username')
  profile(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
  ): Promise<UserProfile> {
    return this.usersService.profile(req.user.sub, username);
  }
}
