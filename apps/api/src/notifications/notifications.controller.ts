import { Controller, Get, HttpCode, HttpStatus, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { CursorPage, PublicNotification, UnreadCountResponse } from '@twitterclone/shared';
import type { JwtPayload } from '../auth/types';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

/** The global JwtAuthGuard rejects the request before `user` can be absent. */
interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<CursorPage<PublicNotification>> {
    return this.notificationsService.list(req.user.sub, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get('unread-count')
  async unreadCount(@Req() req: AuthenticatedRequest): Promise<UnreadCountResponse> {
    return this.notificationsService.unreadCount(req.user.sub);
  }

  @Patch('read')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Req() req: AuthenticatedRequest): Promise<{ success: true }> {
    await this.notificationsService.markAllRead(req.user.sub);
    return { success: true };
  }
}
