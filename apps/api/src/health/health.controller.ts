import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@twitterclone/shared';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async getHealth(): Promise<HealthStatus> {
    // Proves both API and database connectivity.
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
