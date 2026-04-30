import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { ActionPlanTaskAccessService } from '../services/action-plan-task-access.service';

interface CompleteTaskPayload {
  evidenceDescription?: string;
}

@Injectable()
export class CompleteTaskUseCase {
  constructor(
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    private readonly actionPlanTaskAccessService: ActionPlanTaskAccessService,
  ) {}

  async execute(taskId: string, payload: CompleteTaskPayload) {
    const evidenceDescription = payload.evidenceDescription?.trim();
    if (!evidenceDescription) {
      throw new BadRequestException('evidenceDescription is required');
    }

    const { task, actionPlan, currentCase } =
      await this.actionPlanTaskAccessService.getTaskContext(taskId);

    task.status = 'DONE';
    task.evidenceDescriptionDone = evidenceDescription;
    task.completedAt = new Date();
    const updated = await this.actionPlanTaskRepository.save(task);

    await this.maybeCloseCase(actionPlan.caseId);
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
      status: 'DONE',
      evidenceDescriptionInprogress: updated.evidenceDescriptionInprogress,
      evidenceDescriptionDone: updated.evidenceDescriptionDone,
      completedAt: updated.completedAt,
    };
  }

  private async maybeCloseCase(caseId: string): Promise<void> {
    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      return;
    }

    const caseTasks = await this.actionPlanTaskRepository
      .createQueryBuilder('task')
      .innerJoin(
        'action_plans',
        'actionPlan',
        'actionPlan.id = task.actionPlanId AND actionPlan.caseId = :caseId',
        { caseId },
      )
      .getMany();

    if (
      caseTasks.length > 0 &&
      caseTasks.every((task) => task.status === 'DONE')
    ) {
      await this.caseRepository.update({ id: caseId }, { status: 'CLOSED' });

      const allIncidentCases = await this.caseRepository.find({
        where: { incidentId: currentCase.incidentId },
      });
      if (
        allIncidentCases.length > 0 &&
        allIncidentCases.every((item) => item.status === 'CLOSED')
      ) {
        await this.incidentRepository.update(
          { id: currentCase.incidentId },
          { status: 'RESOLVED', resolvedDate: new Date() },
        );
      }
    }
  }
}
