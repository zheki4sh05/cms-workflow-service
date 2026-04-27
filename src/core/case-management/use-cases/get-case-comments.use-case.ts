import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseCommentOrmEntity } from '../../../infrastructure/case-management/persistence/case-comment.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCollaborationAccessService } from '../services/case-collaboration-access.service';

@Injectable()
export class GetCaseCommentsUseCase {
  constructor(
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(CaseCommentOrmEntity)
    private readonly commentRepository: Repository<CaseCommentOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
  ) {}

  async execute(caseId: string) {
    const currentCase = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }
    if (currentCase.status !== 'INVESTIGATING') {
      throw new BadRequestException(
        'Comments are available only for cases in INVESTIGATING status',
      );
    }

    await this.caseCollaborationAccessService.assertCanCollaborate(currentCase);

    const comments = await this.commentRepository.find({
      where: { caseId: currentCase.id },
      order: { time: 'ASC' },
    });

    return comments.map((item) => ({
      id: item.id,
      caseId: item.caseId,
      userId: item.userId,
      content: item.comment,
      time: item.time,
    }));
  }
}
