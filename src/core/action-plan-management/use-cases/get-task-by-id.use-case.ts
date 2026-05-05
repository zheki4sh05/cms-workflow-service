import { ForbiddenException, Injectable } from '@nestjs/common';
import { ActionPlanTaskAccessService } from '../services/action-plan-task-access.service';

@Injectable()
export class GetTaskByIdUseCase {
  constructor(
    private readonly actionPlanTaskAccessService: ActionPlanTaskAccessService,
  ) {}

  async execute(taskId: string) {
    const { task, actionPlan, currentCase, incident } =
      await this.actionPlanTaskAccessService.getTaskContext(taskId);
    if (!actionPlan.showTasks) {
      throw new ForbiddenException(
        'Tasks are available only for action plans in ACTION_IN_PROGRESS stage',
      );
    }

    return {
      id: task.id,
      actionPlanId: task.actionPlanId,
      caseId: actionPlan.caseId,
      caseStatus: currentCase.status,
      incidentId: actionPlan.incidentId,
      documentId: incident.documentId ?? null,
      incidentStatus: incident.status,
      comment: actionPlan.comment,
      actionPlanTitle: actionPlan.title,
      actionPlanDescription: actionPlan.description,
      actionPlanComment: actionPlan.comment,
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
