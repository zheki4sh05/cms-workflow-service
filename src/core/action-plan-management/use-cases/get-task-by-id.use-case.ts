import { Injectable } from '@nestjs/common';
import { ActionPlanTaskAccessService } from '../services/action-plan-task-access.service';

@Injectable()
export class GetTaskByIdUseCase {
  constructor(
    private readonly actionPlanTaskAccessService: ActionPlanTaskAccessService,
  ) {}

  async execute(taskId: string) {
    const { task, actionPlan, currentCase } =
      await this.actionPlanTaskAccessService.getTaskContext(taskId);

    return {
      id: task.id,
      actionPlanId: task.actionPlanId,
      caseId: actionPlan.caseId,
      caseStatus: currentCase.status,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      status: task.status,
      evidenceDescriptionInprogress: task.evidenceDescriptionInprogress,
      evidenceDescriptionDone: task.evidenceDescriptionDone,
      completedAt: task.completedAt,
    };
  }
}
