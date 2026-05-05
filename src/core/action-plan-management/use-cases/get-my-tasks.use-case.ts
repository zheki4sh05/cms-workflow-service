import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { ActionPlanTaskAccessService } from '../services/action-plan-task-access.service';

@Injectable()
export class GetMyTasksUseCase {
  constructor(
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    private readonly actionPlanTaskAccessService: ActionPlanTaskAccessService,
  ) {}

  async execute() {
    const user = await this.actionPlanTaskAccessService.fetchCurrentUser();
    const assignedUserIds = [user.id, user.employeeId].filter(
      Boolean,
    ) as string[];
    if (assignedUserIds.length === 0) {
      return [];
    }

    const cases = await this.caseRepository.find({
      where: assignedUserIds.map((assignedUserId) => ({ assignedUserId })),
    });
    if (cases.length === 0) {
      return [];
    }

    const caseIds = cases.map((item) => item.id);
    const actionPlans = await this.actionPlanRepository.find({
      where: { caseId: In(caseIds) },
    });
    if (actionPlans.length === 0) {
      return [];
    }

    const visibleActionPlans = actionPlans.filter((plan) => plan.showTasks);
    if (visibleActionPlans.length === 0) {
      return [];
    }

    const actionPlanById = new Map(
      visibleActionPlans.map((plan) => [plan.id, plan]),
    );
    const caseById = new Map(cases.map((item) => [item.id, item]));
    const incidents = await this.incidentRepository.find({
      where: { id: In(visibleActionPlans.map((plan) => plan.incidentId)) },
    });
    const incidentById = new Map(incidents.map((item) => [item.id, item]));

    const tasks = await this.actionPlanTaskRepository.find({
      where: { actionPlanId: In(visibleActionPlans.map((plan) => plan.id)) },
      order: { dueDate: 'ASC' },
    });

    return tasks.map((task) => {
      const actionPlan = actionPlanById.get(task.actionPlanId);
      const currentCase = actionPlan
        ? caseById.get(actionPlan.caseId)
        : undefined;
      const incident = actionPlan
        ? incidentById.get(actionPlan.incidentId)
        : undefined;
      return {
        id: task.id,
        actionPlanId: task.actionPlanId,
        caseId: actionPlan?.caseId ?? null,
        caseStatus: currentCase?.status ?? null,
        incidentId: actionPlan?.incidentId ?? null,
        documentId: incident?.documentId ?? null,
        incidentStatus: incident?.status ?? null,
        comment: actionPlan?.comment ?? null,
        actionPlanTitle: actionPlan?.title ?? null,
        actionPlanDescription: actionPlan?.description ?? null,
        actionPlanComment: actionPlan?.comment ?? null,
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        status: task.status,
        evidenceDescriptionInprogress: task.evidenceDescriptionInprogress,
        evidenceDescriptionDone: task.evidenceDescriptionDone,
        completedAt: task.completedAt,
      };
    });
  }
}
