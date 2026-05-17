import { Injectable, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
import { CaseCollaborationAccessService } from '../../case-management/services/case-collaboration-access.service';
import { ActionPlanTaskAccessService } from '../services/action-plan-task-access.service';
import { getOptionalEnvOrDefault } from '../../../web/app/env';

export interface ActionPlanListItemResult {
  id: string;
  caseId: string;
  incidentId: string;
  caseStatus: string;
  riskObjectName: string | null;
  /** Колонка `details` из `findings` для finding кейса. */
  details: Record<string, unknown> | null;
  title: string | null;
  description: string | null;
  showTasks: boolean;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    assigneeId?: string;
    status: string;
    dueAt?: Date;
  }>;
}

interface RiskObjectApiResponse {
  name?: string;
}

function riskObjectLookupKey(companyId: string, riskObjectId: string): string {
  return `${companyId}\t${riskObjectId}`;
}

function mapTaskListStatus(task: ActionPlanTaskOrmEntity): string {
  const now = Date.now();
  if (task.status === 'DONE') {
    return 'done';
  }
  if (task.dueDate && task.dueDate.getTime() < now) {
    return 'overdue';
  }
  if (task.status === 'IN_PROGRESS') {
    return 'in_progress';
  }
  return 'todo';
}

@Injectable({ scope: Scope.REQUEST })
export class GetActionPlanListUseCase {
  constructor(
    private readonly actionPlanTaskAccessService: ActionPlanTaskAccessService,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
  ) {}

  async execute(): Promise<ActionPlanListItemResult[]> {
    const user = await this.actionPlanTaskAccessService.fetchCurrentUser();
    const roles =
      await this.caseCollaborationAccessService.fetchUserRoles(user.id);
    if (!roles.includes('MANAGER')) {
      return [];
    }

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
    const caseStatusById = new Map(cases.map((c) => [c.id, c.status]));
    const caseFindingIdByCaseId = new Map(cases.map((c) => [c.id, c.findingId]));

    const actionPlans = await this.actionPlanRepository.find({
      where: { caseId: In(caseIds) },
      order: { id: 'ASC' },
    });

    if (actionPlans.length === 0) {
      return [];
    }

    const incidentIds = Array.from(
      new Set(actionPlans.map((plan) => plan.incidentId)),
    );
    const incidents =
      incidentIds.length > 0
        ? await this.incidentRepository.find({
            where: { id: In(incidentIds) },
          })
        : [];
    const incidentById = new Map(incidents.map((i) => [i.id, i]));

    const riskObjectLookups = incidents.map((incident) => ({
      companyId: incident.companyId,
      riskObjectId: incident.riskObjectId,
    }));
    const riskObjectNameByKey =
      await this.fetchRiskObjectDisplayNames(riskObjectLookups);

    const findingIds = Array.from(
      new Set(
        actionPlans
          .map((plan) => caseFindingIdByCaseId.get(plan.caseId))
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const findings =
      findingIds.length > 0
        ? await this.findingRepository.find({
            where: { id: In(findingIds) },
          })
        : [];
    const findingDetailsById = new Map(
      findings.map((f) => [f.id, f.details]),
    );

    const planIds = actionPlans.map((plan) => plan.id);
    const tasks = await this.actionPlanTaskRepository.find({
      where: { actionPlanId: In(planIds) },
      order: { dueDate: 'ASC' },
    });

    const tasksByPlanId = new Map<string, ActionPlanTaskOrmEntity[]>();
    for (const task of tasks) {
      const list = tasksByPlanId.get(task.actionPlanId) ?? [];
      list.push(task);
      tasksByPlanId.set(task.actionPlanId, list);
    }

    return actionPlans.map((plan) => {
      const incident = incidentById.get(plan.incidentId);
      let riskObjectName: string | null = null;
      if (incident) {
        const key = riskObjectLookupKey(
          incident.companyId,
          incident.riskObjectId,
        );
        riskObjectName =
          riskObjectNameByKey.get(key) ?? incident.riskObjectId;
      }

      const findingId = caseFindingIdByCaseId.get(plan.caseId);
      const details = findingId
        ? findingDetailsById.get(findingId) ?? null
        : null;

      return {
        id: plan.id,
        caseId: plan.caseId,
        incidentId: plan.incidentId,
        caseStatus: caseStatusById.get(plan.caseId) ?? 'UNKNOWN',
        riskObjectName,
        details,
        title: plan.title,
        description: plan.description,
        showTasks: plan.showTasks,
        tasks: (tasksByPlanId.get(plan.id) ?? []).map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: mapTaskListStatus(task),
          dueAt: task.dueDate,
        })),
      };
    });
  }

  private async fetchRiskObjectDisplayNames(
    lookups: Array<{ companyId: string; riskObjectId: string }>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (lookups.length === 0) {
      return result;
    }

    const monitoringUrl = getOptionalEnvOrDefault(
      'CMS_MONITORING_SERVICE_URL',
      'http://localhost:9093',
    );

    const uniqueKeys = new Set(
      lookups.map((item) =>
        riskObjectLookupKey(item.companyId, item.riskObjectId),
      ),
    );

    await Promise.all(
      [...uniqueKeys].map(async (key) => {
        const tab = key.indexOf('\t');
        const companyId = key.slice(0, tab);
        const riskObjectId = key.slice(tab + 1);

        try {
          const response = await fetch(
            `${monitoringUrl}/api/internal/risk-objects/${riskObjectId}`,
            { headers: { CompanyId: companyId } },
          );
          if (!response.ok) {
            result.set(key, riskObjectId);
            return;
          }
          const body = (await response.json()) as RiskObjectApiResponse;
          const name = body.name?.trim();
          result.set(key, name && name.length > 0 ? name : riskObjectId);
        } catch {
          result.set(key, riskObjectId);
        }
      }),
    );

    return result;
  }
}
