import { Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'crypto';
import { getNumberEnvOrDefault } from '../../web/app/env';

@Injectable()
export class MinioStorageService {
  private readonly bucketName =
    process.env.MINIO_BUCKET?.trim() || 'cms-workflow-attachments';
  private readonly client = new Client({
    endPoint: process.env.MINIO_ENDPOINT?.trim() || 'localhost',
    port: getNumberEnvOrDefault('MINIO_PORT', 9000),
    useSSL: (process.env.MINIO_USE_SSL?.trim() || 'false') === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY?.trim() || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY?.trim() || 'minioadmin',
  });

  async uploadCaseAttachment(file: Express.Multer.File): Promise<string> {
    const fileId = randomUUID();
    await this.ensureBucket();
    await this.client.putObject(
      this.bucketName,
      fileId,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype || 'application/octet-stream',
      },
    );
    return fileId;
  }

  private async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucketName);
    if (!exists) {
      await this.client.makeBucket(this.bucketName);
    }
  }
}
