import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { UserListResponse, UserProfile } from '@twitterclone/shared';
import type { JwtPayload } from '../auth/types';
import { SearchUsersDto } from './dto/search-users.dto';
import { UsersService } from './users.service';

/** The global JwtAuthGuard rejects the request before `user` can be absent. */
interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  search(
    @Req() req: AuthenticatedRequest,
    @Query() query: SearchUsersDto,
  ): Promise<UserListResponse> {
    return this.usersService.search(req.user.sub, query.q);
  }

  @Get(':username')
  profile(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
  ): Promise<UserProfile> {
    return this.usersService.profile(req.user.sub, username);
  }
}
