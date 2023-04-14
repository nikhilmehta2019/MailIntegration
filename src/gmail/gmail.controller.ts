import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { CreateGmailDto } from './dto/create-gmail.dto';
import { UpdateGmailDto } from './dto/update-gmail.dto';

@Controller('gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  @Post()
  create(@Body() createGmailDto: CreateGmailDto) {
    return this.gmailService.create(createGmailDto);
  }

  @Get()
  findAll() {
    return this.gmailService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gmailService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGmailDto: UpdateGmailDto) {
    return this.gmailService.update(+id, updateGmailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gmailService.remove(+id);
  }
}
