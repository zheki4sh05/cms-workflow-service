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
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';

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

interface InternalUserProfileResponse {
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  fullName?: string;
  displayName?: string;
  login?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    fullName?: string;
    displayName?: string;
    login?: string;
  };
}

export interface ManagerKpiItem {
  managerId: string;
  managerName: string;
  assignedIncidents: number;
  resolvedIncidents: number;
  activeCases: number;
  completedCases: number;
  avgResolutionTime: number;
  onTimeCompletion: number;
}

export interface ManagerKpiListResult {
  items: ManagerKpiItem[];
}

@Injectable({ scope: Scope.REQUEST })
export class GetManagerKpiListUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
  ) {}

  async execute(): Promise<ManagerKpiListResult> {
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    const isExecutive = roles.includes('EXECUTIVE');
    const isSupervisor = roles.includes('SUPERVISOR');
    if (!isExecutive && !isSupervisor) {
      throw new ForbiddenException(
        'Only SUPERVISOR and EXECUTIVE can access manager KPI',
      );
    }

    const targetUserIds = isExecutive
      ? await this.resolveCompanyAssigneeIds(user.companyId)
      : await this.resolveDepartmentSubordinateIds(user);

    if (targetUserIds.length === 0) {
      return { items: [] };
    }

    const companyId = user.companyId;
    const [cases, findings] = await Promise.all([
      this.caseRepository
        .createQueryBuilder('c')
        .innerJoinAndSelect('c.incident', 'i')
        .where('i.companyId = :companyId', { companyId })
        .andWhere('c.assignedUserId IN (:...ids)', { ids: targetUserIds })
        .getMany(),
      this.findingRepository
        .createQueryBuilder('f')
        .innerJoinAndSelect('f.incident', 'i')
        .where('i.companyId = :companyId', { companyId })
        .andWhere('f.assignedUserId IN (:...ids)', { ids: targetUserIds })
        .getMany(),
    ]);

    const tasks = await this.actionPlanTaskRepository
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.actionPlan', 'ap')
      .innerJoinAndSelect('ap.case', 'c')
      .innerJoin('c.incident', 'i')
      .where('c.assignedUserId IN (:...ids)', { ids: targetUserIds })
      .andWhere('i.companyId = :companyId', { companyId })
      .getMany();

    const incidentsById = new Map<string, IncidentOrmEntity>();
    const casesByUser = new Map<string, CaseOrmEntity[]>();
    const findingsByUser = new Map<string, FindingOrmEntity[]>();

    for (const currentCase of cases) {
      const uid = currentCase.assignedUserId?.trim();
      if (!uid) {
        continue;
      }
      incidentsById.set(currentCase.incidentId, currentCase.incident);
      const list = casesByUser.get(uid) ?? [];
      list.push(currentCase);
      casesByUser.set(uid, list);
    }

    for (const finding of findings) {
      const uid = finding.assignedUserId?.trim();
      if (!uid) {
        continue;
      }
      incidentsById.set(finding.incidentId, finding.incident);
      const list = findingsByUser.get(uid) ?? [];
      list.push(finding);
      findingsByUser.set(uid, list);
    }

    const allIncidentIds = Array.from(
      new Set([
        ...cases.map((c) => c.incidentId),
        ...findings.map((f) => f.incidentId),
      ]),
    );
    const extraIncidents =
      allIncidentIds.length > 0
        ? await this.incidentRepository.find({
            where: { id: In(allIncidentIds) },
          })
        : [];
    for (const inc of extraIncidents) {
      incidentsById.set(inc.id, inc);
    }

    const allFindingsForIncidents =
      allIncidentIds.length > 0
        ? await this.findingRepository.find({
            where: { incidentId: In(allIncidentIds) },
          })
        : [];
    const findingsByIncidentId = this.groupBy(allFindingsForIncidents, (f) => f.incidentId);

    const tasksByUser = new Map<string, ActionPlanTaskOrmEntity[]>();
    for (const task of tasks) {
      const uid = task.actionPlan?.case?.assignedUserId?.trim();
      if (!uid) {
        continue;
      }
      const list = tasksByUser.get(uid) ?? [];
      list.push(task);
      tasksByUser.set(uid, list);
    }

    const nameMap = await this.fetchUserNamesById(targetUserIds);

    const items: ManagerKpiItem[] = [];
    for (const managerId of targetUserIds) {
      const userCases = casesByUser.get(managerId) ?? [];
      const userFindings = findingsByUser.get(managerId) ?? [];

      const incidentIdSet = new Set<string>();
      for (const c of userCases) {
        incidentIdSet.add(c.incidentId);
      }
      for (const f of userFindings) {
        incidentIdSet.add(f.incidentId);
      }

      let resolvedIncidents = 0;
      for (const incidentId of incidentIdSet) {
        const incident = incidentsById.get(incidentId);
        if (incident?.status === 'RESOLVED') {
          resolvedIncidents += 1;
        }
      }

      let activeCases = 0;
      let completedCases = 0;
      for (const currentCase of userCases) {
        if (currentCase.status === 'CLOSED') {
          completedCases += 1;
        } else {
          activeCases += 1;
        }
      }

      const incidentsForAvg = Array.from(incidentIdSet)
        .map((id) => incidentsById.get(id))
        .filter((inc): inc is IncidentOrmEntity => {
          if (!inc) {
            return false;
          }
          return inc.status === 'RESOLVED' && inc.resolvedDate !== null;
        });
      const avgResolutionTime = this.calculateAverageResolutionTimeInHours(
        incidentsForAvg,
        findingsByIncidentId,
      );

      const userTasks = tasksByUser.get(managerId) ?? [];
      const onTimeCompletion = this.calculateOnTimeCompletionPercent(userTasks);

      const nameParts = nameMap.get(managerId);
      const managerName = this.formatDisplayName(nameParts?.firstName, nameParts?.lastName);

      items.push({
        managerId,
        managerName,
        assignedIncidents: incidentIdSet.size,
        resolvedIncidents,
        activeCases,
        completedCases,
        avgResolutionTime,
        onTimeCompletion,
      });
    }

    items.sort((a, b) => a.managerName.localeCompare(b.managerName, 'ru'));

    return { items };
  }

  private async resolveCompanyAssigneeIds(companyId: string): Promise<string[]> {
    const caseRows = await this.caseRepository
      .createQueryBuilder('c')
      .innerJoin('c.incident', 'i')
      .where('i.companyId = :companyId', { companyId })
      .andWhere('c.assignedUserId IS NOT NULL')
      .select('DISTINCT c.assignedUserId', 'uid')
      .getRawMany<{ uid: string }>();

    const findingRows = await this.findingRepository
      .createQueryBuilder('f')
      .innerJoin('f.incident', 'i')
      .where('i.companyId = :companyId', { companyId })
      .andWhere('f.assignedUserId IS NOT NULL')
      .select('DISTINCT f.assignedUserId', 'uid')
      .getRawMany<{ uid: string }>();

    const merged = [...caseRows, ...findingRows]
      .map((row) => row.uid?.trim())
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    return [...new Set(merged)];
  }

  private async resolveDepartmentSubordinateIds(user: AuthUserDto): Promise<string[]> {
    const employeeId = this.resolveEmployeeIdForCompanyServices(user);
    const subordinates = await this.fetchDepartmentManagerSubordinates({
      userId: user.id,
      employeeId,
      companyId: user.companyId,
    });
    return [...new Set(subordinates)];
  }

  private resolveEmployeeIdForCompanyServices(user: AuthUserDto): string {
    const fromHeader = this.request.header('EmployeeId')?.trim();
    const fromProfile = user.employeeId?.trim();
    const employeeId = fromHeader || fromProfile;
    if (!employeeId) {
      throw new BadRequestException(
        'EmployeeId header or profile employeeId is required for supervisor manager KPI',
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

  private calculateOnTimeCompletionPercent(tasks: ActionPlanTaskOrmEntity[]): number {
    const done = tasks.filter((t) => t.status === 'DONE');
    if (done.length === 0) {
      return 0;
    }
    let onTime = 0;
    for (const task of done) {
      if (!task.completedAt) {
        continue;
      }
      if (task.completedAt.getTime() <= task.dueDate.getTime()) {
        onTime += 1;
      }
    }
    return Math.round((onTime / done.length) * 100);
  }

  private calculateAverageResolutionTimeInHours(
    incidents: IncidentOrmEntity[],
    findingsByIncidentId: Map<string, FindingOrmEntity[]>,
  ): number {
    const values: number[] = [];
    for (const incident of incidents) {
      if (!incident.resolvedDate) {
        continue;
      }
      const incidentFindings = findingsByIncidentId.get(incident.id) ?? [];
      const detectedAt = this.resolveIncidentDetectedAt(incidentFindings);
      if (!detectedAt) {
        continue;
      }
      const diffMs = incident.resolvedDate.getTime() - detectedAt.getTime();
      if (diffMs >= 0) {
        values.push(diffMs / (1000 * 60 * 60));
      }
    }

    if (values.length === 0) {
      return 0;
    }
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.round(avg);
  }

  private resolveIncidentDetectedAt(findings: FindingOrmEntity[]): Date | null {
    let earliest: Date | null = null;
    for (const finding of findings) {
      const directDate = finding.detectedAt ?? null;
      const detailsDate = this.parseDateFromUnknown(finding.details.foundAt);
      const date = directDate ?? detailsDate;
      if (!date) {
        continue;
      }
      if (!earliest || date.getTime() < earliest.getTime()) {
        earliest = date;
      }
    }
    return earliest;
  }

  private parseDateFromUnknown(value: unknown): Date | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private groupBy<T, K>(items: T[], keyResolver: (item: T) => K): Map<K, T[]> {
    const grouped = new Map<K, T[]>();
    for (const item of items) {
      const key = keyResolver(item);
      const current = grouped.get(key) ?? [];
      current.push(item);
      grouped.set(key, current);
    }
    return grouped;
  }

  private formatDisplayName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
  ): string {
    const parts = [firstName?.trim(), lastName?.trim()].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    );
    return parts.length > 0 ? parts.join(' ') : '';
  }

  private async fetchUserNamesById(
    userIds: string[],
  ): Promise<Map<string, { firstName: string | null; lastName: string | null }>> {
    const result = new Map<string, { firstName: string | null; lastName: string | null }>();
    if (userIds.length === 0) {
      return result;
    }

    const authServiceUrl = process.env.CMS_AUTH_SERVICE_URL;
    if (!authServiceUrl) {
      throw new BadRequestException('CMS_AUTH_SERVICE_URL is not configured');
    }

    const authorization = this.request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authorization header is required');
    }

    await Promise.all(
      userIds.map(async (userId) => {
        const response = await fetch(`${authServiceUrl}/api/internal/users/${userId}`, {
          headers: { authorization },
        });
        if (!response.ok) {
          result.set(userId, { firstName: null, lastName: null });
          return;
        }
        const body = (await response.json()) as InternalUserProfileResponse;
        const parts = this.extractUserNameParts(body);
        result.set(userId, parts);
      }),
    );

    return result;
  }

  private extractUserNameParts(payload: InternalUserProfileResponse): {
    firstName: string | null;
    lastName: string | null;
  } {
    const nested = payload.user ?? {};

    const firstNameCandidates = [
      payload.firstName,
      payload.first_name,
      nested.firstName,
      nested.first_name,
    ];
    const lastNameCandidates = [
      payload.lastName,
      payload.last_name,
      nested.lastName,
      nested.last_name,
    ];

    const firstName = this.pickNonEmpty(firstNameCandidates);
    const lastName = this.pickNonEmpty(lastNameCandidates);
    if (firstName || lastName) {
      return { firstName, lastName };
    }

    const fullName = this.pickNonEmpty([
      payload.fullName,
      payload.displayName,
      payload.name,
      nested.fullName,
      nested.displayName,
      nested.name,
      payload.login,
      nested.login,
    ]);
    if (!fullName) {
      return { firstName: null, lastName: null };
    }

    const [first, ...rest] = fullName.trim().split(/\s+/);
    return {
      firstName: first || null,
      lastName: rest.length > 0 ? rest.join(' ') : null,
    };
  }

  private pickNonEmpty(values: Array<string | undefined | null>): string | null {
    const value = values.find(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
    return value?.trim() ?? null;
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
