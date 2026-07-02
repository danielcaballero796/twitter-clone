import { IsEmail, IsString, MaxLength } from 'class-validator';
import type { LoginRequest } from '@twitterclone/shared';

export class LoginDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(72)
  password!: string;
}
