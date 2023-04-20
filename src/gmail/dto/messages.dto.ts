import { IsInt, IsString } from 'class-validator';

export class Messages {
  @IsInt()
  userId: number;
}
