import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { ActionPlanTaskEvidenceOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task-evidence.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { CaseCollaborationAccessService } from '../../case-management/services/case-collaboration-access.service';
import { MinioStorageService } from '../../../infrastructure/storage/minio-storage.service';
import { UploadedFile } from '../../case-management/types/uploaded-file.type';

interface AddActionPlanTaskEvidencePayload {
  file?: UploadedFile;
}

@Injectable()
export class AddActionPlanTaskEvidenceUseCase {
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
    payload: AddActionPlanTaskEvidencePayload,
  ) {
    const file = payload.file;
    if (!file) {
      throw new BadRequestException('file is required');
    }

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
        'Task evidences can be added only for cases in ACTION_IN_PROGRESS status',
      );
    }

    const user =
      await this.caseCollaborationAccessService.assertCanCollaborate(currentCase);
    const fileId = await this.minioStorageService.uploadCaseAttachment(file);
    const name = file.originalname?.trim() || fileId;

    const created = await this.evidenceRepository.save({
      id: randomUUID(),
      taskId: task.id,
      userId: user.id,
      fileId,
      name,
      time: new Date(),
    });

    return {
      id: created.id,
      actionPlanId,
      taskId: created.taskId,
      userId: created.userId,
      fileId: created.fileId,
      name: created.name,
      time: created.time,
    };
  }
}
