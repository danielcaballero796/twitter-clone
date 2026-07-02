import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { RegisterRequest } from '@twitterclone/shared';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'username must be 3-20 characters (letters, numbers, underscore)',
  })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;
}
