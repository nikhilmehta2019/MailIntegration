import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { google } from 'googleapis';
// import { googleUserModel, MailModel } from '../models';
// import { ParseEmailAndMakeFiles } from '../utils/mailHelper';
import { Credentials, OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'crypto';
import { GoogleUser } from './entities/google.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { retry } from 'rxjs';
import { FileService } from 'src/shared/file.service';
import { Mail } from './entities/mail.entity';
import * as path from 'path';
import { File } from './entities/file.entity';
@Injectable()
export class GmailService {
  constructor(
    @InjectRepository(GoogleUser)
    private googleUserRepository: Repository<GoogleUser>,
    @InjectRepository(File)
    private FileRepository: Repository<File>,
    @InjectRepository(Mail)
    private mailRepository: Repository<Mail>,
    private readonly filesService: FileService,
  ) {}
  scope = ['https://www.googleapis.com/auth/gmail.readonly'];
  async oauth2Client() {
    return await new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
      // 'http://localhost:3000/oauth2callback',
    );
  }

  async getLoginUrl() {
    const client = await this.oauth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.scope,
    });
  }

  async saveUser(code: string, userId: number, email: string) {
    const client = await this.oauth2Client();
    const { tokens } = await client.getToken(code);

    const user = await this.googleUserRepository.find({
      where:{
        userId: userId,
        frzind:false
      },
    })

    console.log(code , userId , email)
    if(user.length){
      return user[0];
    }
    return await this.googleUserRepository.save({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: String(tokens.expiry_date),
      scope: tokens.scope!,
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
    let pageToken: string | null = null
    let scannedDocLimit = 10000;
    do {
      if (scannedDocLimit <= 0) {
        console.log("10,000 message limit reached")
        break;
      }
      const otherQuery = {}
      if (pageToken) {
        otherQuery["pageToken"] = pageToken
      }
      const res = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['CATEGORY_PERSONAL'],
        ...otherQuery
      });

      pageToken = res.data.nextPageToken;
      const messages = res.data.messages;
      scannedDocLimit -= messages.length;
      for (const message of messages) {
        //Check If Mail Already Scanned
        const dbEmail = await this.mailRepository.findBy({
          messageId: message.id,
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
            .value.toLowerCase(),
        );
        const body = this.convertStringToLatin1(mail.data.payload.body.data);

        const emailDate = this.formatDate(
          mail.data.payload.headers
            .find((e) => e.name.toLowerCase() === 'date')
            .value.toLowerCase(),
        );

        const from = this.convertStringToLatin1(
          mail.data.payload.headers
            .find((e) => e.name.toLowerCase() === 'from')
            .value.toLowerCase(),
        );

        if (!subject) {
          //withourt subject just save so we dont scan it again
          await this.mailRepository.save({
            subject: 'N/A',
            userId: userId,
            messageId: message.id,
            isRelatable: false,
            date: emailDate,
            from: from,
            updatedAt: new Date(),
            updatedBy: userId,
          });
          continue;
        }

        //check if subject is relatable with model
        const isRelatable =
          this.isMailRelatable(subject) || this.isMailRelatable(body);
        if (!isRelatable) {
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
        const attachments = mail?.data?.payload?.parts?.filter((e) => e.filename);
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

    } while (pageToken)
  }


  isMailRelatable(subject: string) {
    const keywords = [
      'medical',
      'report',
      'lab',
      'test',
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
      'prescription'
    ];
    for (const keyword of keywords) {
      if (subject.toLowerCase().includes(keyword.toLowerCase())) {
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
}

// const {OAuth2Client} = require('google-auth-library');

// export class GmailService {
//   static scope = ['https://www.googleapis.com/auth/gmail.readonly'];

//   static async getOAuthClient() {
//     return new OAuth2Client(
//       process.env.GOOGLE_CLIENT_ID,
//       process.env.GOOGLE_CLIENT_SECRET,
//       'http://localhost:3000/oauth2callback',
//     );
//   }
//   static async getLoginUrl() {
//     const client = await this.getOAuthClient();
//     return client.generateAuthUrl({
//       access_type: 'offline',
//       prompt: 'consent',
//       scope: this.scope,
//     });
//   }

//   static async saveGmailUser(userId, code) {
//     const client = await this.getOAuthClient();
//     const r = await client.getToken(code);
//     console.log(r.tokens);
//     try {
//       await googleUserModel.create({
//         userId,
//         ...r.tokens,
//       });
//     } catch {
//       return false;
//     }
//   }

//   static async saveLatestMails(userId) {
//     const user = await googleUserModel.findOne({userId});
//     const client = await this.getOAuthClient();
//     client.setCredentials(user);
//     const gmail = google.gmail({version: 'v1', auth: client});
//     const res = await gmail.users.messages.list({
//       userId: 'me',
//     });
//     //get mail that is not in db
//     const messages = res.data.messages;
//     for (const message of messages) {
//       const mail = await MailModel.findOne({
//         messageId: message.id,
//       });
//       if (!mail) {
//         const mailData = await gmail.users.messages.get({
//           userId: 'me',
//           id: message.id,
//         });

//         await ParseEmailAndMakeFiles(mailData.data, client, user._id);
//         await MailModel.create({
//           tenantId: user._id,
//           messageId: message.id,
//           ...mailData.data,
//         });
//       } else {
//         break;
//       }
//     }

//     // return res.data;
//   }
// }
