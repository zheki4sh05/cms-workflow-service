import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActionPlanTaskOrmEntity,
  ActionPlanTaskStatus,
} from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { ActionPlanTaskAccessService } from '../services/action-plan-task-access.service';

interface UpdateTaskPayload {
  status?: string;
  evidenceDescription?: string;
}

@Injectable()
export class UpdateTaskUseCase {
  constructor(
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    private readonly actionPlanTaskAccessService: ActionPlanTaskAccessService,
  ) {}

  async execute(taskId: string, payload: UpdateTaskPayload) {
    const { task, actionPlan, currentCase } =
      await this.actionPlanTaskAccessService.getTaskContext(taskId);

    const nextStatus = payload.status ? this.normalizeStatus(payload.status) : undefined;
    const evidenceDescription = payload.evidenceDescription?.trim();

    if (!nextStatus && !evidenceDescription) {
      throw new BadRequestException('At least one field is required');
    }

    if (nextStatus) {
      task.status = nextStatus;
      if (nextStatus === 'IN_PROGRESS' && evidenceDescription) {
        task.evidenceDescriptionInprogress = evidenceDescription;
      }
      if (nextStatus === 'DONE') {
        if (evidenceDescription) {
          task.evidenceDescriptionDone = evidenceDescription;
        }
        task.completedAt = task.completedAt ?? new Date();
        await this.maybeCloseCase(actionPlan.caseId);
      }
      if (nextStatus === 'TODO') {
        task.completedAt = null;
      }
    } else if (evidenceDescription && task.status === 'IN_PROGRESS') {
      task.evidenceDescriptionInprogress = evidenceDescription;
    }

    const updated = await this.actionPlanTaskRepository.save(task);
    const refreshedCase = await this.caseRepository.findOne({
      where: { id: actionPlan.caseId },
    });

    return {
      id: updated.id,
      actionPlanId: updated.actionPlanId,
      caseId: actionPlan.caseId,
      caseStatus: refreshedCase?.status ?? currentCase.status,
      title: updated.title,
      description: updated.description,
      priority: updated.priority,
      dueDate: updated.dueDate,
      status: updated.status,
      evidenceDescriptionInprogress: updated.evidenceDescriptionInprogress,
      evidenceDescriptionDone: updated.evidenceDescriptionDone,
      completedAt: updated.completedAt,
    };
  }

  private normalizeStatus(status: string): ActionPlanTaskStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }
    if (normalized === 'TODO' || normalized === 'DONE') {
      return normalized;
    }

    throw new BadRequestException('status must be TODO, IN_PROGRESS or DONE');
  }

  private async maybeCloseCase(caseId: string): Promise<void> {
    const caseTasks = await this.actionPlanTaskRepository
      .createQueryBuilder('task')
      .innerJoin(
        'action_plans',
        'actionPlan',
        'actionPlan.id = task.actionPlanId AND actionPlan.caseId = :caseId',
        { caseId },
      )
      .getMany();

    if (caseTasks.length > 0 && caseTasks.every((task) => task.status === 'DONE')) {
      await this.caseRepository.update({ id: caseId }, { status: 'CLOSED' });
    }
  }
}
