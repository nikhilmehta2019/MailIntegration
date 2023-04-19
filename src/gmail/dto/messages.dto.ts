import { IsString } from 'class-validator';

export class Messages {
  @IsString()
  userId: string;
}
