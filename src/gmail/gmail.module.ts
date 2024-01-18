import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleUser } from './entities/google.entity';
import { Mail } from './entities/mail.entity';
import { FileService } from 'src/shared/file.service';
import { File } from './entities/file.entity';
import { EmailKeywords } from './entities/keyword.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GoogleUser, Mail, File, EmailKeywords])],
  controllers: [GmailController],
  providers: [GmailService, FileService],
})
export class GmailModule {}
