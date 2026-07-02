import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { MAX_TWEET_LENGTH, type CreateTweetRequest } from '@twitterclone/shared';

export class CreateTweetDto implements CreateTweetRequest {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : (value as unknown)))
  @IsString()
  @Length(1, MAX_TWEET_LENGTH)
  content!: string;
}
