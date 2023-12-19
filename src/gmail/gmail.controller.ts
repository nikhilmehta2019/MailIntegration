import { Body, Controller, Get, HttpStatus, Post, Res } from '@nestjs/common';
import { CreateGmailDto } from './dto/create-gmail.dto';
import { GmailService } from './gmail.service';
import { Messages } from './dto/messages.dto';
import { Response } from 'express';

@Controller('gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  @Get('login-url')
  async getLoginUrl() {
    return await this.gmailService.getLoginUrl();
  }

  @Post('save-user')
  async create(@Body() createGmailDto: CreateGmailDto) {
    return await this.gmailService.saveUser(
      createGmailDto.code,
      createGmailDto.userId,
      createGmailDto.email,
    );
  }

  @Post('save-messages')
  async getMessages(@Body() getMessageDto: Messages, @Res() res: Response) {
    res.status(200).json({
      totalMessages: await this.gmailService.getQueueMessageCount(),
    });

    return await this.gmailService.getMessagesWithAttachments(
      getMessageDto.userId,
    );
  }

  @Post('fit')
  async getFitData(@Body() getMessageDto: Messages) {
    return await this.gmailService.getFitData(getMessageDto.userId);
  }
}
