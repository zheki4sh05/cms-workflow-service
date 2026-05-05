import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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
  private readonly logger = new Logger(MinioStorageService.name);
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
    try {
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
    } catch (error) {
      this.rethrowStorageError('upload attachment', error);
    }
  }

  async downloadAttachment(fileId: string): Promise<{
    stream: Readable;
    contentType: string;
    size: number;
  }> {
    try {
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
    } catch (error) {
      this.rethrowStorageError('download attachment', error);
    }
  }

  async removeAttachment(fileId: string): Promise<void> {
    try {
      await this.ensureBucket();
      await this.client.removeObject(this.bucketName, fileId);
    } catch (error) {
      this.rethrowStorageError('remove attachment', error);
    }
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName);
      }
    } catch (error) {
      this.rethrowStorageError('check bucket availability', error);
    }
  }

  private rethrowStorageError(action: string, error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Failed to ${action} in MinIO: ${message}`);
    throw new ServiceUnavailableException(
      'File storage is temporarily unavailable',
    );
  }
}
