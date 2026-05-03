import { Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'crypto';
import {
  getNumberEnvOrDefault,
  getOptionalEnvOrDefault,
} from '../../web/app/env';
import { UploadedFile } from '../../core/case-management/types/uploaded-file.type';
import { Readable } from 'stream';

@Injectable()
export class MinioStorageService {
  private readonly bucketName = getOptionalEnvOrDefault(
    'MINIO_BUCKET',
    'cms-workflow-attachments',
  );
  private readonly client = new Client({
    endPoint: getOptionalEnvOrDefault('MINIO_ENDPOINT', 'localhost'),
    // Дефолт 9020 — как в docker-compose (хост); внутри контейнера API всё равно 9000
    port: getNumberEnvOrDefault('MINIO_PORT', 9020),
    useSSL: getOptionalEnvOrDefault('MINIO_USE_SSL', 'false') === 'true',
    accessKey: getOptionalEnvOrDefault('MINIO_ACCESS_KEY', 'minioadmin'),
    secretKey: getOptionalEnvOrDefault('MINIO_SECRET_KEY', 'minioadmin'),
  });

  async uploadCaseAttachment(file: UploadedFile): Promise<string> {
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

  async downloadAttachment(fileId: string): Promise<{
    stream: Readable;
    contentType: string;
    size: number;
  }> {
    await this.ensureBucket();
    const stat = await this.client.statObject(this.bucketName, fileId);
    const stream = await this.client.getObject(this.bucketName, fileId);
    const rawSize = stat.size;
    const size =
      typeof rawSize === 'bigint'
        ? Number(rawSize)
        : Number(rawSize);

    return {
      stream,
      contentType:
        stat.metaData?.['content-type'] || 'application/octet-stream',
      size: Number.isFinite(size) ? size : 0,
    };
  }

  async removeAttachment(fileId: string): Promise<void> {
    await this.ensureBucket();
    await this.client.removeObject(this.bucketName, fileId);
  }

  private async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucketName);
    if (!exists) {
      await this.client.makeBucket(this.bucketName);
    }
  }
}
