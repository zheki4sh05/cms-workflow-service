import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCommentOrmEntity } from '../../../infrastructure/case-management/persistence/case-comment.orm-entity';
import { CaseCollaborationAccessService } from '../services/case-collaboration-access.service';

interface AddCaseCommentPayload {
  content?: string;
}

@Injectable()
export class AddCaseCommentUseCase {
  constructor(
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(CaseCommentOrmEntity)
    private readonly commentRepository: Repository<CaseCommentOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
  ) {}

  async execute(caseId: string, payload: AddCaseCommentPayload) {
    const content = payload.content?.trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }
    if (currentCase.status !== 'INVESTIGATING') {
      throw new BadRequestException(
        'Comments can be added only for cases in INVESTIGATING status',
      );
    }
    const user =
      await this.caseCollaborationAccessService.assertCanCollaborate(
        currentCase,
      );

    const created = await this.commentRepository.save({
      id: randomUUID(),
      caseId: currentCase.id,
      userId: user.id,
      comment: content,
      time: new Date(),
    });

    return {
      id: created.id,
      caseId: created.caseId,
      userId: created.userId,
      content: created.comment,
      time: created.time,
    };
  }
}
