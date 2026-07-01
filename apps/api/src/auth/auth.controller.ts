import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { PublicUser } from '@twitterclone/shared';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE, buildAccessTokenCookieOptions } from './cookie';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

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

  @Get('me')
  async me(@Req() req: Request): Promise<PublicUser> {
    const user = req.user && (await this.usersService.findById(req.user.sub));
    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    return this.usersService.toPublicUser(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(ACCESS_TOKEN_COOKIE, buildAccessTokenCookieOptions());
    return { success: true };
  }
}
