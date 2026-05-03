import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseAttachmentOrmEntity } from '../../../infrastructure/case-management/persistence/case-attachment.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCollaborationAccessService } from '../services/case-collaboration-access.service';

@Injectable()
export class GetCaseAttachmentsUseCase {
  constructor(
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(CaseAttachmentOrmEntity)
    private readonly attachmentRepository: Repository<CaseAttachmentOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
  ) {}

  async execute(caseId: string) {
    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    await this.caseCollaborationAccessService.assertCanCollaborate(currentCase);

    const attachments = await this.attachmentRepository.find({
      where: { caseId: currentCase.id },
      order: { time: 'ASC' },
    });

    return attachments.map((item) => ({
      id: item.id,
      caseId: item.caseId,
      userId: item.userId,
      fileId: item.fileId,
      name: item.name,
      size: item.size,
      time: item.time,
    }));
  }
}
