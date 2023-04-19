import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
@Injectable()
export class FileService {
  async saveBase64AsFile(
    base64String: string,
    filePath: string,
    fileName: string,
  ): Promise<void> {
    const base64Data = base64String.replace(/^data:.*;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fullPath = `${filePath}/${fileName}`;

    const parentDirectoryPath = filePath;
    const isDirectoryExist = fs.existsSync(parentDirectoryPath);
    console.log(isDirectoryExist);
    if (!isDirectoryExist) {
      fs.mkdirSync(parentDirectoryPath, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, buffer);
  }
}
