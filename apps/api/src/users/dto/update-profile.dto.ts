import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AVATAR_STYLES, type AvatarStyle } from '@twitterclone/shared';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName?: string;

  /** Empty string is allowed and clears the bio (stored as null). */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;

  @IsOptional()
  @IsIn(AVATAR_STYLES)
  avatarStyle?: AvatarStyle;
}
