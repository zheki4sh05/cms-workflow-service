import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ActionPlanTaskEvidenceOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task-evidence.orm-entity';
import { MinioStorageService } from '../../../infrastructure/storage/minio-storage.service';
import { UploadedFile } from '../../case-management/types/uploaded-file.type';
import { ActionPlanTaskAccessService } from '../services/action-plan-task-access.service';

interface AddTaskEvidencePayload {
  file?: UploadedFile;
}

@Injectable()
export class AddTaskEvidenceUseCase {
  constructor(
    @InjectRepository(ActionPlanTaskEvidenceOrmEntity)
    private readonly evidenceRepository: Repository<ActionPlanTaskEvidenceOrmEntity>,
    private readonly actionPlanTaskAccessService: ActionPlanTaskAccessService,
    private readonly minioStorageService: MinioStorageService,
  ) {}

  async execute(taskId: string, payload: AddTaskEvidencePayload) {
    const file = payload.file;
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const { task, actionPlan, currentCase } =
      await this.actionPlanTaskAccessService.getTaskContext(taskId);
    if (currentCase.status !== 'ACTION_IN_PROGRESS') {
      throw new BadRequestException(
        'Task evidences can be added only for cases in ACTION_IN_PROGRESS status',
      );
    }

    const user = await this.actionPlanTaskAccessService.fetchCurrentUser();
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
      taskId: created.taskId,
      actionPlanId: actionPlan.id,
      userId: created.userId,
      fileId: created.fileId,
      name: created.name,
      time: created.time,
    };
  }
}
