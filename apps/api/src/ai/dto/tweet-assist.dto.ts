import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
  MIN_ASSIST_LENGTH,
  TWEET_ASSIST_ACTIONS,
  type TweetAssistAction,
} from '@twitterclone/shared';

export class TweetAssistDto {
  // Max is 2x the tweet limit on purpose: "shorten" is most useful precisely
  // when the draft has overflowed 280 characters.
  @IsString()
  @MinLength(MIN_ASSIST_LENGTH)
  @MaxLength(560)
  text!: string;

  @IsIn(TWEET_ASSIST_ACTIONS)
  action!: TweetAssistAction;
}
