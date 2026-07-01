import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { PublicUser } from '@twitterclone/shared';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE, buildAccessTokenCookieOptions } from './cookie';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const { user, accessToken } = await this.authService.login(dto);
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, buildAccessTokenCookieOptions());
    return user;
  }
}
