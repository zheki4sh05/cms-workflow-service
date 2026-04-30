import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { ActionPlanTaskEvidenceOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task-evidence.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCollaborationAccessService } from '../../case-management/services/case-collaboration-access.service';
import { MinioStorageService } from '../../../infrastructure/storage/minio-storage.service';
import { Readable } from 'stream';

@Injectable()
export class DownloadActionPlanTaskEvidenceUseCase {
  constructor(
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(ActionPlanTaskEvidenceOrmEntity)
    private readonly evidenceRepository: Repository<ActionPlanTaskEvidenceOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
    private readonly minioStorageService: MinioStorageService,
  ) {}

  async execute(
    actionPlanId: string,
    taskId: string,
    evidenceId: string,
  ): Promise<{ stream: Readable; fileName: string; contentType: string }> {
    const actionPlan = await this.actionPlanRepository.findOne({
      where: { id: actionPlanId },
    });
    if (!actionPlan) {
      throw new NotFoundException('Action plan not found');
    }

    const task = await this.actionPlanTaskRepository.findOne({
      where: { id: taskId, actionPlanId: actionPlan.id },
    });
    if (!task) {
      throw new NotFoundException('Action plan task not found');
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: actionPlan.caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    if (currentCase.status !== 'ACTION_IN_PROGRESS') {
      throw new BadRequestException(
        'Task evidences are available only for cases in ACTION_IN_PROGRESS status',
      );
    }

    await this.caseCollaborationAccessService.assertCanCollaborate(currentCase);

    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, taskId: task.id },
    });
    if (!evidence) {
      throw new NotFoundException('Task evidence not found');
    }

    const file = await this.minioStorageService.downloadAttachment(
      evidence.fileId,
    );
    return {
      stream: file.stream,
      fileName: evidence.name,
      contentType: file.contentType,
    };
  }
}
