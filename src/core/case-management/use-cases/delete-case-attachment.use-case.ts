import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseAttachmentOrmEntity } from '../../../infrastructure/case-management/persistence/case-attachment.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCollaborationAccessService } from '../services/case-collaboration-access.service';
import { MinioStorageService } from '../../../infrastructure/storage/minio-storage.service';

@Injectable()
export class DeleteCaseAttachmentUseCase {
  constructor(
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(CaseAttachmentOrmEntity)
    private readonly attachmentRepository: Repository<CaseAttachmentOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
    private readonly minioStorageService: MinioStorageService,
  ) {}

  async execute(caseId: string, attachmentId: string): Promise<void> {
    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }
    if (currentCase.status !== 'INVESTIGATING') {
      throw new BadRequestException(
        'Attachments can be changed only for cases in INVESTIGATING status',
      );
    }

    await this.caseCollaborationAccessService.assertCanCollaborate(currentCase);

    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, caseId: currentCase.id },
    });
    if (!attachment) {
      throw new NotFoundException('Case attachment not found');
    }

    await this.minioStorageService.removeAttachment(attachment.fileId);
    await this.attachmentRepository.delete({
      id: attachmentId,
      caseId: currentCase.id,
    });
  }
}
