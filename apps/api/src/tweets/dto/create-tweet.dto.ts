import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class CreateTweetDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : (value as unknown)))
  @IsString()
  @Length(1, 280)
  content!: string;
}
