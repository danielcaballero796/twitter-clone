import { IsString, Length } from 'class-validator';

export class SearchUsersDto {
  @IsString()
  @Length(1, 50)
  q!: string;
}
