import {
  BadRequestException,
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

type Severity = 'low' | 'medium' | 'high';

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

interface RuleDetailsResponse {
  id: string;
  severity?: string;
  categoryId?: string | null;
  category_id?: string | null;
}

interface RiskObjectResponse {
  id: string;
  severity?: string;
}

interface RiskCategoryItem {
  id: string;
  name: string;
}

interface IncidentCategoryStats {
  categoryId: string | null;
  categoryName: string;
  incidentCount: number;
}

interface ManagerIncidentStatsResult {
  totalIncidents: number;
  totalFindings: number;
  totalCases: number;
  new: number;
  assigned: number;
  inReview: number;
  resolved: number;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
  };
  byCategory: IncidentCategoryStats[];
  avgResolutionTime: number;
}

@Injectable({ scope: Scope.REQUEST })
export class GetMyIncidentStatsUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
  ) {}

  async execute(): Promise<ManagerIncidentStatsResult> {
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    const assignedUserIds = await this.resolveAvailableAssigneeIds(user, roles);
    if (assignedUserIds.length === 0) {
      return this.buildEmptyStats();
    }

    const [cases, assignedFindings] = await Promise.all([
      this.caseRepository.find({
        where: assignedUserIds.map((assignedUserId) => ({ assignedUserId })),
      }),
      this.findingRepository.find({
        where: assignedUserIds.map((assignedUserId) => ({ assignedUserId })),
      }),
    ]);

    const incidentIds = [
      ...new Set([
        ...cases.map((item) => item.incidentId),
        ...assignedFindings.map((item) => item.incidentId),
      ]),
    ];
    if (incidentIds.length === 0) {
      return this.buildEmptyStats();
    }

    const incidents = await this.incidentRepository.find({
      where: {
        id: In(incidentIds),
        companyId: user.companyId,
      },
    });
    if (incidents.length === 0) {
      return this.buildEmptyStats();
    }

    const fullIncidentIds = incidents.map((item) => item.id);
    const [findings, allCases] = await Promise.all([
      this.findingRepository.find({
        where: {
          incidentId: In(fullIncidentIds),
        },
      }),
      this.caseRepository.find({
        where: {
          incidentId: In(fullIncidentIds),
        },
      }),
    ]);
    const findingsByIncidentId = this.groupBy(findings, (item) => item.incidentId);

    const ruleIds = Array.from(
      new Set(
        findings
          .map((finding) => this.extractRuleId(finding))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const [ruleMap, categoryMap] = await Promise.all([
      this.fetchRules(ruleIds),
      this.fetchRiskCategories(user.companyId),
    ]);

    const riskObjectMap = await this.fetchRiskObjects(
      incidents.map((incident) => incident.riskObjectId),
      user.companyId,
    );

    const workingIncidentIds = new Set(fullIncidentIds);
    const newCount = incidents.filter((incident) => incident.status === 'OPEN').length;
    const resolvedCount = incidents.filter(
      (incident) => incident.status === 'RESOLVED',
    ).length;
    const assignedCount = incidents.filter((incident) => {
      if (incident.status === 'OPEN') {
        return false;
      }
      const incidentFindings = findingsByIncidentId.get(incident.id) ?? [];
      return incidentFindings.some(
        (finding) => Boolean(finding.assignedUserId?.trim()),
      );
    }).length;

    const inReviewIncidentIds = new Set(
      cases
        .filter((currentCase) => currentCase.status === 'WAITING_VERIFICATION')
        .map((currentCase) => currentCase.incidentId),
    );

    const bySeverity = {
      low: 0,
      medium: 0,
      high: 0,
    };
    const categoryCounter = new Map<string, IncidentCategoryStats>();

    for (const incident of incidents) {
      const incidentFindings = findingsByIncidentId.get(incident.id) ?? [];
      const relatedRules = incidentFindings
        .map((finding) => {
          const ruleId = this.extractRuleId(finding);
          if (!ruleId) {
            return null;
          }
          return ruleMap.get(ruleId) ?? null;
        })
        .filter((item): item is RuleDetailsResponse => Boolean(item));

      const severity = this.resolveIncidentSeverity(
        relatedRules,
        riskObjectMap.get(incident.riskObjectId)?.severity,
      );
      bySeverity[severity] += 1;

      const category = this.resolveCategory(relatedRules, categoryMap);
      const categoryKey = category?.id ?? '__uncategorized__';
      const existing = categoryCounter.get(categoryKey);
      if (existing) {
        existing.incidentCount += 1;
      } else {
        categoryCounter.set(categoryKey, {
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? 'Без категории',
          incidentCount: 1,
        });
      }
    }

    const avgResolutionTime = this.calculateAverageResolutionTimeInHours(
      incidents.filter(
        (incident) =>
          incident.status === 'RESOLVED' &&
          incident.resolvedDate !== null &&
          workingIncidentIds.has(incident.id),
      ),
      findingsByIncidentId,
    );

    return {
      totalIncidents: incidents.length,
      totalFindings: findings.length,
      totalCases: allCases.length,
      new: newCount,
      assigned: assignedCount,
      inReview: inReviewIncidentIds.size,
      resolved: resolvedCount,
      bySeverity,
      byCategory: Array.from(categoryCounter.values()).sort((a, b) =>
        a.categoryName.localeCompare(b.categoryName),
      ),
      avgResolutionTime,
    };
  }

  private buildEmptyStats(): ManagerIncidentStatsResult {
    return {
      totalIncidents: 0,
      totalFindings: 0,
      totalCases: 0,
      new: 0,
      assigned: 0,
      inReview: 0,
      resolved: 0,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
      },
      byCategory: [],
      avgResolutionTime: 0,
    };
  }

  private async resolveAvailableAssigneeIds(
    user: AuthUserDto,
    roles: string[],
  ): Promise<string[]> {
    if (roles.includes('SUPERVISOR')) {
      const employeeId = this.resolveEmployeeIdForCompanyServices(user);
      const subordinates = await this.fetchDepartmentManagerSubordinates({
        userId: user.id,
        employeeId,
        companyId: user.companyId,
      });
      return [...new Set(subordinates)];
    }

    if (roles.includes('MANAGER')) {
      return [user.id, user.employeeId].filter(Boolean);
    }

    return [];
  }

  private resolveEmployeeIdForCompanyServices(user: AuthUserDto): string {
    const fromHeader = this.request.header('EmployeeId')?.trim();
    const fromProfile = user.employeeId?.trim();
    const employeeId = fromHeader || fromProfile;
    if (!employeeId) {
      throw new BadRequestException(
        'EmployeeId header or profile employeeId is required for supervisor incident stats',
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

  private extractRuleId(finding: FindingOrmEntity): string | null {
    if (finding.rulesId) {
      return finding.rulesId;
    }
    const details = finding.details;
    const possibleRuleId =
      details.rulesId ?? details.ruleId ?? details.rules_id ?? null;
    return typeof possibleRuleId === 'string' && possibleRuleId.length > 0
      ? possibleRuleId
      : null;
  }

  private async fetchRules(
    ruleIds: string[],
  ): Promise<Map<string, RuleDetailsResponse>> {
    if (ruleIds.length === 0) {
      return new Map();
    }

    const riskServiceUrl =
      process.env.CMS_RISK_SERVICE_URL?.trim() ?? 'http://localhost:9094';

    const responses = await Promise.all(
      ruleIds.map(async (ruleId) => {
        const response = await fetch(`${riskServiceUrl}/api/internal/rules/${ruleId}`);
        if (!response.ok) {
          return [ruleId, { id: ruleId }] as const;
        }
        return [ruleId, (await response.json()) as RuleDetailsResponse] as const;
      }),
    );

    return new Map(responses);
  }

  private async fetchRiskCategories(
    companyId: string,
  ): Promise<Map<string, RiskCategoryItem>> {
    const riskServiceUrl =
      process.env.CMS_RISK_SERVICE_URL?.trim() ?? 'http://localhost:9094';

    const response = await fetch(`${riskServiceUrl}/api/internal/risk-categories`, {
      headers: {
        CompanyId: companyId,
      },
    });
    if (!response.ok) {
      return new Map();
    }
    const body = (await response.json()) as { items?: RiskCategoryItem[] };
    return new Map((body.items ?? []).map((item) => [item.id, item]));
  }

  private async fetchRiskObjects(
    riskObjectIds: string[],
    companyId: string,
  ): Promise<Map<string, RiskObjectResponse>> {
    const monitoringServiceUrl = process.env.CMS_MONITORING_SERVICE_URL?.trim();
    if (!monitoringServiceUrl) {
      throw new BadRequestException('CMS_MONITORING_SERVICE_URL is not configured');
    }

    const uniqueRiskObjectIds = [...new Set(riskObjectIds)];
    const responses = await Promise.all(
      uniqueRiskObjectIds.map(async (riskObjectId) => {
        const response = await fetch(
          `${monitoringServiceUrl}/api/internal/risk-objects/${riskObjectId}`,
          {
            headers: {
              CompanyId: companyId,
            },
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

  private resolveCategory(
    rules: RuleDetailsResponse[],
    categoryMap: Map<string, RiskCategoryItem>,
  ): RiskCategoryItem | null {
    for (const rule of rules) {
      const categoryId = rule.categoryId ?? rule.category_id ?? null;
      if (categoryId && categoryMap.has(categoryId)) {
        return categoryMap.get(categoryId)!;
      }
    }
    return null;
  }

  private resolveIncidentSeverity(
    rules: RuleDetailsResponse[],
    riskObjectSeverity?: string,
  ): Severity {
    const ruleScores = rules
      .map((rule) => this.severityToScore(rule.severity))
      .filter((score): score is number => score !== null);

    const ruleAverageScore =
      ruleScores.length > 0
        ? ruleScores.reduce((sum, score) => sum + score, 0) / ruleScores.length
        : 1;
    const nearestRuleSeverity = this.scoreToSeverity(Math.round(ruleAverageScore));

    const riskObjectScore = this.severityToScore(riskObjectSeverity);
    if (riskObjectScore !== null && riskObjectScore > ruleAverageScore) {
      return this.scoreToSeverity(riskObjectScore);
    }

    return nearestRuleSeverity;
  }

  private severityToScore(value?: string): number | null {
    if (!value) {
      return null;
    }
    switch (value.toLowerCase()) {
      case 'low':
        return 1;
      case 'medium':
        return 2;
      case 'high':
        return 3;
      default:
        return null;
    }
  }

  private scoreToSeverity(score: number): Severity {
    if (score <= 1) {
      return 'low';
    }
    if (score >= 3) {
      return 'high';
    }
    return 'medium';
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
}
