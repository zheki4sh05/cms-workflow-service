import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { In, Repository } from 'typeorm';
import { getOptionalEnvOrDefault } from '../../../web/app/env';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';

type OverviewScope = 'COMPANY' | 'DEPARTMENT';

type SeverityBucket = 'low' | 'medium' | 'high' | 'unknown';

interface AuthUserDto {
  id: string;
  companyId: string;
  employeeId: string;
}

interface InternalUserDto {
  roles?: string[];
}

interface DepartmentManagerSubordinatesResponse {
  userIds?: string[];
}

interface RiskObjectResponse {
  id: string;
  name?: string;
  severity?: string;
}

export interface RiskHotspotItem {
  riskObjectId: string;
  riskObjectName: string | null;
  incidentCount: number;
}

export interface OperationsOverviewResult {
  scope: OverviewScope;
  incidents: {
    total: number;
    open: number;
    partlyProgress: number;
    inProgress: number;
    resolved: number;
    linkedToDocument: number;
    withoutDocument: number;
    /** Не решены и ранняя дата обнаружения старше staleDays */
    staleUnresolved: number;
  };
  findings: {
    total: number;
    unassigned: number;
  };
  cases: {
    total: number;
    waitingVerification: number;
    closed: number;
    /** total - closed - waitingVerification (остальные статусы) */
    other: number;
  };
  actionPlans: {
    /** Планы, где есть незавершённая задача с просроченным dueDate */
    withOverdueTasks: number;
  };
  /** Топ объектов риска по числу инцидентов в выборке */
  riskHotspots: RiskHotspotItem[];
  /** По полю severity объекта мониторинга (CMS_MONITORING) */
  incidentsByRiskObjectSeverity: Record<SeverityBucket, number>;
}

const STALE_UNRESOLVED_DAYS = 14;
const HOTSPOT_LIMIT = 5;

@Injectable({ scope: Scope.REQUEST })
export class GetOperationsOverviewUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
  ) {}

  async execute(): Promise<OperationsOverviewResult> {
    const emptySeverity: Record<SeverityBucket, number> = {
      low: 0,
      medium: 0,
      high: 0,
      unknown: 0,
    };

    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    const isExecutive = roles.includes('EXECUTIVE');
    const isExecutor = roles.includes('EXECUTOR');
    const isSupervisor = roles.includes('SUPERVISOR');
    const companyWide = isExecutive || isExecutor;
    if (!companyWide && !isSupervisor) {
      throw new ForbiddenException(
        'Only SUPERVISOR, EXECUTIVE and EXECUTOR can access operations overview',
      );
    }

    const scope: OverviewScope = companyWide ? 'COMPANY' : 'DEPARTMENT';
    let incidents: IncidentOrmEntity[];

    if (companyWide) {
      incidents = await this.incidentRepository.find({
        where: { companyId: user.companyId },
      });
    } else {
      const employeeId = this.resolveEmployeeIdForCompanyServices(user);
      const subordinates = await this.fetchDepartmentManagerSubordinates({
        userId: user.id,
        employeeId,
        companyId: user.companyId,
      });
      const subordinateUserIds = [...new Set(subordinates)];
      if (subordinateUserIds.length === 0) {
        return this.buildEmptyOverview(scope);
      }

      const [cases, assignedFindings] = await Promise.all([
        this.caseRepository.find({
          where: subordinateUserIds.map((assignedUserId) => ({ assignedUserId })),
        }),
        this.findingRepository.find({
          where: subordinateUserIds.map((assignedUserId) => ({ assignedUserId })),
        }),
      ]);

      const incidentIds = [
        ...new Set([
          ...cases.map((c) => c.incidentId),
          ...assignedFindings.map((f) => f.incidentId),
        ]),
      ];

      if (incidentIds.length === 0) {
        return this.buildEmptyOverview(scope);
      }

      incidents = await this.incidentRepository.find({
        where: {
          id: In(incidentIds),
          companyId: user.companyId,
        },
      });
    }

    if (incidents.length === 0) {
      return this.buildEmptyOverview(scope);
    }

    const incidentIds = incidents.map((i) => i.id);
    const [findings, cases, actionPlans] = await Promise.all([
      this.findingRepository.find({ where: { incidentId: In(incidentIds) } }),
      this.caseRepository.find({ where: { incidentId: In(incidentIds) } }),
      this.actionPlanRepository.find({ where: { incidentId: In(incidentIds) } }),
    ]);

    const findingsByIncident = this.groupBy(findings, (f) => f.incidentId);
    const earliestByIncident = this.buildEarliestDetectionByIncident(findingsByIncident);

    const staleCutoff = Date.now() - STALE_UNRESOLVED_DAYS * 24 * 60 * 60 * 1000;
    let staleUnresolved = 0;
    let open = 0;
    let partlyProgress = 0;
    let inProgress = 0;
    let resolved = 0;
    let linkedToDocument = 0;
    let withoutDocument = 0;

    for (const inc of incidents) {
      switch (inc.status) {
        case 'OPEN':
          open += 1;
          break;
        case 'PARTLY_PROGRESS':
          partlyProgress += 1;
          break;
        case 'IN_PROGRESS':
          inProgress += 1;
          break;
        case 'RESOLVED':
          resolved += 1;
          break;
        default:
          break;
      }

      const doc = inc.documentId?.trim();
      if (doc) {
        linkedToDocument += 1;
      } else {
        withoutDocument += 1;
      }

      if (inc.status !== 'RESOLVED') {
        const t = earliestByIncident.get(inc.id);
        if (t !== undefined && t <= staleCutoff) {
          staleUnresolved += 1;
        }
      }
    }

    let unassignedFindings = 0;
    for (const f of findings) {
      if (!f.assignedUserId?.trim()) {
        unassignedFindings += 1;
      }
    }

    let waitingVerification = 0;
    let closedCases = 0;
    for (const c of cases) {
      if (c.status === 'WAITING_VERIFICATION') {
        waitingVerification += 1;
      }
      if (c.status === 'CLOSED') {
        closedCases += 1;
      }
    }

    const withOverdueTasks = await this.countActionPlansWithOverdueTasks(actionPlans);

    const riskObjectMap = await this.fetchRiskObjects(
      incidents.map((i) => i.riskObjectId),
      user.companyId,
    );

    const byRoSeverity: Record<SeverityBucket, number> = { ...emptySeverity };
    const countByRiskObject = new Map<string, number>();
    for (const inc of incidents) {
      const bucket = this.normalizeSeverityBucket(
        riskObjectMap.get(inc.riskObjectId)?.severity,
      );
      byRoSeverity[bucket] += 1;
      const key = inc.riskObjectId;
      countByRiskObject.set(key, (countByRiskObject.get(key) ?? 0) + 1);
    }

    const riskHotspots: RiskHotspotItem[] = Array.from(countByRiskObject.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, HOTSPOT_LIMIT)
      .map(([riskObjectId, incidentCount]) => ({
        riskObjectId,
        riskObjectName: riskObjectMap.get(riskObjectId)?.name ?? null,
        incidentCount,
      }));

    const totalCases = cases.length;
    const casesOther = totalCases - closedCases - waitingVerification;

    return {
      scope,
      incidents: {
        total: incidents.length,
        open,
        partlyProgress,
        inProgress,
        resolved,
        linkedToDocument,
        withoutDocument,
        staleUnresolved,
      },
      findings: {
        total: findings.length,
        unassigned: unassignedFindings,
      },
      cases: {
        total: totalCases,
        waitingVerification,
        closed: closedCases,
        other: casesOther,
      },
      actionPlans: {
        withOverdueTasks,
      },
      riskHotspots,
      incidentsByRiskObjectSeverity: byRoSeverity,
    };
  }

  private buildEmptyOverview(scope: OverviewScope): OperationsOverviewResult {
    const zeros: Record<SeverityBucket, number> = {
      low: 0,
      medium: 0,
      high: 0,
      unknown: 0,
    };
    return {
      scope,
      incidents: {
        total: 0,
        open: 0,
        partlyProgress: 0,
        inProgress: 0,
        resolved: 0,
        linkedToDocument: 0,
        withoutDocument: 0,
        staleUnresolved: 0,
      },
      findings: { total: 0, unassigned: 0 },
      cases: { total: 0, waitingVerification: 0, closed: 0, other: 0 },
      actionPlans: { withOverdueTasks: 0 },
      riskHotspots: [],
      incidentsByRiskObjectSeverity: zeros,
    };
  }

  private buildEarliestDetectionByIncident(
    findingsByIncident: Map<string, FindingOrmEntity[]>,
  ): Map<string, number> {
    const result = new Map<string, number>();
    for (const [incidentId, list] of findingsByIncident) {
      let minMs = Infinity;
      for (const f of list) {
        const d = f.detectedAt ?? this.parseDateFromUnknown(f.details.foundAt);
        if (d && !Number.isNaN(d.getTime())) {
          minMs = Math.min(minMs, d.getTime());
        }
      }
      if (Number.isFinite(minMs)) {
        result.set(incidentId, minMs);
      }
    }
    return result;
  }

  private normalizeSeverityBucket(severity?: string): SeverityBucket {
    if (!severity) {
      return 'unknown';
    }
    const s = severity.toLowerCase();
    if (s === 'low' || s === 'medium' || s === 'high') {
      return s;
    }
    return 'unknown';
  }

  private async countActionPlansWithOverdueTasks(
    actionPlans: ActionPlanOrmEntity[],
  ): Promise<number> {
    if (actionPlans.length === 0) {
      return 0;
    }
    const actionPlanIds = actionPlans.map((p) => p.id);
    const tasks = await this.actionPlanTaskRepository.find({
      where: { actionPlanId: In(actionPlanIds) },
    });
    const now = Date.now();
    const overduePlanIds = new Set(
      tasks
        .filter(
          (task) =>
            task.status !== 'DONE' &&
            task.dueDate instanceof Date &&
            task.dueDate.getTime() < now,
        )
        .map((task) => task.actionPlanId),
    );
    return overduePlanIds.size;
  }

  private parseDateFromUnknown(value: unknown): Date | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }

  private async fetchRiskObjects(
    riskObjectIds: string[],
    companyId: string,
  ): Promise<Map<string, RiskObjectResponse>> {
    const monitoringServiceUrl = process.env.CMS_MONITORING_SERVICE_URL?.trim();
    if (!monitoringServiceUrl) {
      throw new BadRequestException('CMS_MONITORING_SERVICE_URL is not configured');
    }
    const unique = [...new Set(riskObjectIds)];
    const responses = await Promise.all(
      unique.map(async (riskObjectId) => {
        const response = await fetch(
          `${monitoringServiceUrl}/api/internal/risk-objects/${riskObjectId}`,
          {
            headers: { CompanyId: companyId },
          },
        );
        if (!response.ok) {
          return [riskObjectId, { id: riskObjectId }] as const;
        }
        return [riskObjectId, (await response.json()) as RiskObjectResponse] as const;
      }),
    );
    return new Map(responses);
  }

  private resolveEmployeeIdForCompanyServices(user: AuthUserDto): string {
    const fromHeader = this.request.header('EmployeeId')?.trim();
    const fromProfile = user.employeeId?.trim();
    const employeeId = fromHeader || fromProfile;
    if (!employeeId) {
      throw new BadRequestException(
        'EmployeeId header or profile employeeId is required for supervisor operations overview',
      );
    }
    return employeeId;
  }

  private async fetchDepartmentManagerSubordinates(params: {
    userId: string;
    employeeId: string;
    companyId: string;
  }): Promise<string[]> {
    const baseUrl = getOptionalEnvOrDefault(
      'CMS_COMPANY_INFO_SERVICE_URL',
      'http://localhost:9092',
    );
    const authorization = this.request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const query = new URLSearchParams({
      userId: params.userId,
      employeeId: params.employeeId,
      companyId: params.companyId,
    });

    const root = baseUrl.replace(/\/$/, '');
    const url = `${root}/employee/department-manager-subordinates?${query.toString()}`;
    const response = await fetch(url, {
      headers: { authorization },
    });

    if (!response.ok) {
      throw new BadRequestException(
        `Unable to fetch department subordinates: status ${response.status}`,
      );
    }

    const body = (await response.json()) as DepartmentManagerSubordinatesResponse;
    if (!Array.isArray(body.userIds)) {
      return [];
    }

    return body.userIds.filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0,
    );
  }

  private async fetchCurrentUser(): Promise<AuthUserDto> {
    const authServiceUrl = process.env.CMS_AUTH_SERVICE_URL;
    if (!authServiceUrl) {
      throw new BadRequestException('CMS_AUTH_SERVICE_URL is not configured');
    }

    const authorization = this.request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const response = await fetch(`${authServiceUrl}/api/users/me`, {
      headers: { authorization },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Unable to fetch current user');
    }

    const user = (await response.json()) as Partial<AuthUserDto>;
    if (!user.id || !user.companyId) {
      throw new UnauthorizedException('Invalid user payload');
    }

    return {
      id: user.id,
      companyId: user.companyId,
      employeeId: user.employeeId ?? '',
    };
  }

  private async fetchUserRoles(userId: string): Promise<string[]> {
    const authServiceUrl = process.env.CMS_AUTH_SERVICE_URL;
    if (!authServiceUrl) {
      throw new BadRequestException('CMS_AUTH_SERVICE_URL is not configured');
    }

    const authorization = this.request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const response = await fetch(`${authServiceUrl}/api/internal/users/${userId}`, {
      headers: { authorization },
    });
    if (!response.ok) {
      throw new UnauthorizedException('Unable to fetch user roles');
    }

    const user = (await response.json()) as InternalUserDto;
    return Array.isArray(user.roles) ? user.roles : [];
  }
}
