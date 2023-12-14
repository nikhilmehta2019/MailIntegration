import { IsInt, IsString } from 'class-validator';

export class CreateGmailDto {
  @IsString()
  code: string;

  @IsInt()
  userId: number;

  
  @IsString()
  email: string;
}
