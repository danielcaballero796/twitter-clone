import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@twitterclone/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthStatus {
    return { status: 'ok' };
  }
}
