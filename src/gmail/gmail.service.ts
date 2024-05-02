import { Injectable } from '@nestjs/common';
import { gmail_v1, google } from 'googleapis';
// import { googleUserModel, MailModel } from '../models';
// import { ParseEmailAndMakeFiles } from '../utils/mailHelper';
import { InjectRepository } from '@nestjs/typeorm';
import { Credentials, OAuth2Client } from 'google-auth-library';
import * as path from 'path';
import { FileService } from 'src/shared/file.service';
import { Repository } from 'typeorm';
import { File } from './entities/file.entity';
import { GoogleUser } from './entities/google.entity';
import { Mail } from './entities/mail.entity';
import queue from 'amqplib';
import { EmailKeywords } from './entities/keyword.entity';
import axios from 'axios';
@Injectable()
export class GmailService {
  constructor(
    @InjectRepository(GoogleUser)
    private googleUserRepository: Repository<GoogleUser>,
    @InjectRepository(File)
    private FileRepository: Repository<File>,
    @InjectRepository(Mail)
    private mailRepository: Repository<Mail>,
    @InjectRepository(EmailKeywords)
    private emailKeywordRepo: Repository<EmailKeywords>,
    private readonly filesService: FileService,
  ) {}
  scope = ['https://www.googleapis.com/auth/gmail.readonly'];
  async oauth2Client() {
    return await new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      // 'https://developers.google.com/oauthplayground',
    );
  }

  rabbitmqConfig = {
    hostname: 'localhost',
    port: 15672,
    username: 'guest',
    password: 'guest',
    vhost: '/',
  };

  async getLoginUrl() {
    const client = await this.oauth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.scope,
    });
  }

  async saveUser(code: string, userId: number, email: string) {
    const user = await this.googleUserRepository.find({
      where: {
        userId: userId,
        frzind: false,
      },
    });

    const client = await this.oauth2Client();
    const { tokens } = await client.getToken(code);

    if (user.length) {
      //if users updates scope and we get new token
      const updatedUser = await this.googleUserRepository.update(
        { userId: userId, frzind: false },
        {
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token!,
          expiry_date: String(tokens.expiry_date),
          scope: '',
          token_type: tokens.token_type!,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      );
      return updatedUser;
    }
    return await this.googleUserRepository.save({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: String(tokens.expiry_date),
      scope: '',
      token_type: tokens.token_type!,
      userId: userId,
      email: email,
      updatedAt: new Date(),
      updatedBy: userId,
    });
  }

  formatDate(dateString: string) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    return formattedDate;
  }

  convertStringToLatin1(str: string) {
    if (!str) return '';
    const buf = Buffer.from(str, 'utf8');
    return buf.toString('ascii');
  }

  endsWithImageOrPDFExtension(input: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png'];
    const pdfExtension = '.pdf';

    const lowerCaseInput = input.toLowerCase();

    return (
      imageExtensions.some((ext) => lowerCaseInput.endsWith(ext)) ||
      lowerCaseInput.endsWith(pdfExtension)
    );
  }
  async getMessagesWithAttachments(userId: number) {
    const client = await this.oauth2Client();
    const user = (
      await this.googleUserRepository.findBy({ userId: userId, frzind: false })
    ).at(0);
    client.setCredentials(user as unknown as Credentials);
    const gmail = google.gmail({ version: 'v1', auth: client });
    let pageToken: string | null = null;
    let scannedDocLimit = 25000;
    do {
      if (scannedDocLimit <= 0) {
        console.log('25,000 message limit reached');
        break;
      }
      const otherQuery = {};
      if (pageToken) {
        otherQuery['pageToken'] = pageToken;
      }
      const res = await gmail.users.messages.list({
        userId: 'me',
        includeSpamTrash: false,
        // labelIds: ['CATEGORY_PERSONAL'],
        ...otherQuery,
      });

      pageToken = res.data.nextPageToken;
      const messages = res.data.messages;
      console.log(res.data);
      scannedDocLimit -= messages?.length ?? scannedDocLimit;
      for (const message of messages) {
        //Check If Mail Already Scanned
        const dbEmail = await this.mailRepository.findBy({
          messageId: message.id,
          userId: userId,
        });

        if (dbEmail.length > 0) {
          //After this email all other emails are already scanned
          console.log('already scanned');
          pageToken = null;
          //Because All Mail After That Are Saved To DB
          break;
        }

        const mail = await gmail.users.messages.get({
          id: message.id,
          userId: 'me',
        });

        const subject = this.convertStringToLatin1(
          mail.data.payload.headers
            .find((e) => e.name.toLowerCase() === 'subject')
            ?.value?.toLowerCase(),
        );
        let body = this.convertStringToLatin1(mail.data.payload.body.data);
        const isZeroSize = mail.data.payload.body.size === 0;

        if (isZeroSize) {
          // Recursively call parts and get data from it'
          const parts = mail.data.payload.parts;
          const html_str = await this.recursive_part_finder(parts);

          body = html_str.replace(/<[^>]*>/g, ' ');
        }

        const emailDate = this.formatDate(
          mail.data.payload.headers
            .find((e) => e.name.toLowerCase() === 'date')
            ?.value?.toLowerCase(),
        );

        const from = this.convertStringToLatin1(
          mail.data.payload.headers
            .find((e) => e.name.toLowerCase() === 'from')
            ?.value?.toLowerCase(),
        );
        // mail.data.payload.

        //check if subject is relatable with model
        const isRelatable =
          (await this.mailRelatable(subject)) ||
          (await this.mailRelatable(body));

        const hasSocialLable =
          mail.data.labelIds?.includes('CATEGORY_PROMOTIONS') ||
          mail.data.labelIds?.includes('CATEGORY_SOCIAL') ||
          mail.data.labelIds?.includes('SENT') ||
          mail.data.labelIds?.includes('DRAFT');

        if (
          !isRelatable ||
          hasSocialLable ||
          !(await this.check_email(from, subject + body))
        ) {
          //withourt subject just save so we dont scan it again
          await this.mailRepository.save({
            userId: userId,
            messageId: message.id,
            isRelatable: false,
            subject: subject,
            date: emailDate,
            from: from,
            updatedAt: new Date(),
            updatedBy: userId,
          });
          continue;
        }
        const attachments = mail?.data?.payload?.parts?.filter(
          (e) => e.filename,
        );
        if (!attachments) {
          //withourt subject just save so we dont scan it again
          await this.mailRepository.save({
            userId: userId,
            messageId: message.id,
            isRelatable: false,
            subject: subject,
            date: emailDate,
            from: from,
            updatedAt: new Date(),
            updatedBy: userId,
          });
          continue;
        }
        const uploadedFileKeys = [];
        for (const attachment of attachments) {
          try {
            const attachmentData = await gmail.users.messages.attachments.get({
              id: attachment.body.attachmentId,
              messageId: message.id,
              userId: 'me',
            });

            const originalFileName = this.convertStringToLatin1(
              attachment.filename,
            );

            if (!this.endsWithImageOrPDFExtension(originalFileName)) {
              continue;
            }

            const randomFolderPathArr = this.generateRandomNumberArray(
              parseInt(process.env.RANDOM_FOLDER_LENGTH!),
            );
            const randomFileNameArr = this.generateRandomNumberArray(
              parseInt(process.env.FILE_NAME_LENGTH!),
            );

            const key =
              randomFolderPathArr.join('') +
              randomFileNameArr.join('') +
              '.' +
              originalFileName.split('.').at(-1);
            const filePath = path.join(
              process.env.BASE_FOLDER_PATH,
              randomFolderPathArr.join('\\'),
            );

            const DbFilePath = path.join(
              'gmailattachment',
              randomFolderPathArr.join('\\'),
              key,
            );

            await this.filesService.saveBase64AsFile(
              attachmentData.data.data,
              filePath,
              key,
            );

            await this.FileRepository.save({
              messageId: message.id,
              userId: userId,
              fileName: originalFileName,
              mimeType: attachment.mimeType,
              filePath: DbFilePath,
            });

            uploadedFileKeys.push(key);
          } catch (err) {
            console.error('Attachment Error', err);
          }
        }
        await this.mailRepository.save({
          userId: userId,
          messageId: message.id,
          isRelatable: true,
          subject: subject,
          date: emailDate,
          from: from,
          updatedAt: new Date(),
          updatedBy: userId,
        });
      }
    } while (pageToken);
  }

  async check_email(from: string, subject: string) {
    const res = await axios.post('https://gmail-api.themedibank.in/predict', {
      from,
      subject,
    });
    if (res.data.prediction === 'No') {
      return false;
    }
    return true;
  }

  isMailRelatable(subject: string) {
    // if(["report" , "test" , "lab"].find(e => subject.toLowerCase().includes(e)))
    // {
    //   return true;
    // }

    const keywords = [
      // 'report',
      // 'test',
      // 'lab',
      'medical',
      'x-ray',
      'xray',
      'scan',
      'radiology',
      'radiologist',
      'radiographic',
      'radiography',
      'radiologist',
      'radiol',
      'path',
      'pathology',
      'health',
      'healthcare',
      'metropolis',
      'blood',
      'discharge summary',
      'prescription',
      'diagnostic',
      'doctor',
      'hospital',
      'clinic',
      'thyrocare',
      'lal path lab',
      'diagnostic',
      'nidaan',
      'nivaran',
    ];
    for (const keyword of keywords) {
      if (subject.toLowerCase().includes(keyword.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  async mailRelatable(text: string) {
    const keywords = await this.emailKeywordRepo.find({});
    const allKeywords = keywords.map((e) => e.Keyword.toLowerCase());
    for (const keyword of allKeywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
  generateRandomNumberArray(length: number) {
    const arr: number[] = [];
    for (let i = 0; i < length; i++) {
      arr.push(Math.floor(Math.random() * 10));
    }
    return arr;
  }

  async getFitData(userId: number) {
    const client = await this.oauth2Client();
    const user = (
      await this.googleUserRepository.findBy({ userId: userId, frzind: false })
    ).at(0);
    client.setCredentials(user as unknown as Credentials);
    const fitness = google.fitness({
      version: 'v1',
      auth: client,
    });

    const data = await fitness.users.dataSources.list({
      userId: 'me',
    });
    const finalData = data.data.dataSource.map(async (e) => {
      // unix number of 1 day before
      const endDate = Math.floor(new Date().getTime() / 1000);
      const startDate = endDate - 86400000;
      console.log(e);
      const userSourceData = await fitness.users.dataSources.datasets.get({
        dataSourceId: e.dataStreamId!,
        userId: 'me',
        datasetId: `${startDate}-${endDate}`,
      });
      return userSourceData.data;
    });

    return { sessionData: await Promise.all(finalData) };
  }

  async getQueueMessageCount() {
    const queueName = 'MailParserReportQueue';

    try {
      const connection = await queue.connect({
        protocol: 'amqp',
        hostname: this.rabbitmqConfig.hostname,
        port: this.rabbitmqConfig.port,
        username: this.rabbitmqConfig.username,
        password: this.rabbitmqConfig.password,
        vhost: this.rabbitmqConfig.vhost,
      });

      const channel = await connection.createChannel();
      const queueInfo = await channel.checkQueue(queueName);

      await connection.close();
      return queueInfo.messageCount;
    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  async recursive_part_finder(parts: gmail_v1.Schema$MessagePart[]) {
    
    let html_str = '';
try{
    for (const part of parts) {
      if (part.mimeType !== 'text/html') {
        if (part.parts?.length > 0) {
          for (const subpart of part.parts) {
            html_str += await this.recursive_part_finder([subpart]);
          }
        }
      } else {
        html_str += this.convertStringToLatin1(
          Buffer.from(part.body.data, 'base64').toString('utf-8'),
        );
      }
    }
  }catch{}
    return html_str;
  }
}
