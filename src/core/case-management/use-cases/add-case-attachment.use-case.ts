import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { CaseAttachmentOrmEntity } from '../../../infrastructure/case-management/persistence/case-attachment.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCollaborationAccessService } from '../services/case-collaboration-access.service';
import { MinioStorageService } from '../../../infrastructure/storage/minio-storage.service';
import { UploadedFile } from '../types/uploaded-file.type';

interface AddCaseAttachmentPayload {
  file?: UploadedFile;
}

@Injectable()
export class AddCaseAttachmentUseCase {
  constructor(
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(CaseAttachmentOrmEntity)
    private readonly attachmentRepository: Repository<CaseAttachmentOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
    private readonly minioStorageService: MinioStorageService,
  ) {}

  async execute(caseId: string, payload: AddCaseAttachmentPayload) {
    const file = payload.file;
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }
    if (currentCase.status !== 'INVESTIGATING') {
      throw new BadRequestException(
        'Attachments can be added only for cases in INVESTIGATING status',
      );
    }
    const user =
      await this.caseCollaborationAccessService.assertCanCollaborate(
        currentCase,
      );
    const fileId = await this.minioStorageService.uploadCaseAttachment(file);
    const name = file.originalname?.trim() || fileId;

    const created = await this.attachmentRepository.save({
      id: randomUUID(),
      caseId: currentCase.id,
      userId: user.id,
      fileId,
      name,
      size: file.size,
      time: new Date(),
    });

    return {
      id: created.id,
      caseId: created.caseId,
      userId: created.userId,
      fileId: created.fileId,
      name: created.name,
      size: created.size,
      time: created.time,
    };
  }
}
