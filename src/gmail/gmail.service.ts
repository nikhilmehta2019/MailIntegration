import { Injectable } from '@nestjs/common';
import { CreateGmailDto } from './dto/create-gmail.dto';
import { UpdateGmailDto } from './dto/update-gmail.dto';

@Injectable()
export class GmailService {
  create(createGmailDto: CreateGmailDto) {
    return 'This action adds a new gmail';
  }

  findAll() {
    return `This action returns all gmail`;
  }

  findOne(id: number) {
    return `This action returns a #${id} gmail`;
  }

  update(id: number, updateGmailDto: UpdateGmailDto) {
    return `This action updates a #${id} gmail`;
  }

  remove(id: number) {
    return `This action removes a #${id} gmail`;
  }
}
