import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'username must be 3-20 characters (letters, numbers, underscore)',
  })
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;
}
