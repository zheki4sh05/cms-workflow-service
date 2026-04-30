import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { In, Repository } from 'typeorm';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';

type Severity = 'low' | 'medium' | 'high';

interface MyIncidentListItem {
  id: string;
  riskObjectId: string;
  riskObjectName: string;
  incidentDescription: string;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  severity: Severity;
  detectedAt: string | null;
}

interface RuleDetailsResponse {
  id: string;
  name?: string;
  severity?: string;
  categoryId?: string | null;
  category_id?: string | null;
  detectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface RiskObjectResponse {
  id: string;
  name?: string;
  severity?: string;
}

interface RiskCategoryItem {
  id: string;
  name: string;
}

interface AuthUserDto {
  id: string;
  companyId: string;
  employeeId: string;
}

@Injectable({ scope: Scope.REQUEST })
export class GetMyIncidentListUseCase {
  private readonly logger = new Logger(GetMyIncidentListUseCase.name);

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
  ) {}

  async execute(): Promise<MyIncidentListItem[]> {
    const user = await this.fetchCurrentUser();
    const assignedUserIds = [user.id, user.employeeId].filter(Boolean);

    if (assignedUserIds.length === 0) {
      return [];
    }

    const cases = await this.caseRepository.find({
      where: assignedUserIds.map((assignedUserId) => ({
        assignedUserId,
      })),
    });

    const incidentIds = Array.from(
      new Set(cases.map((item) => item.incidentId)),
    );
    if (incidentIds.length === 0) {
      return [];
    }

    const incidents = await this.incidentRepository.find({
      where: {
        id: In(incidentIds),
        companyId: user.companyId,
      },
    });

    if (incidents.length === 0) {
      return [];
    }

    const findings = await this.findingRepository.find({
      where: {
        incidentId: In(incidents.map((incident) => incident.id)),
      },
    });

    const findingsByIncidentId = this.groupBy(
      findings,
      (finding) => finding.incidentId,
    );
    const ruleIds = Array.from(
      new Set(
        findings
          .map((finding) => this.extractRuleId(finding))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const categoryMap = await this.fetchRiskCategories(user.companyId);
    const ruleMap = await this.fetchRules(ruleIds);

    return Promise.all(
      incidents.map(async (incident) => {
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

        const riskObject = await this.fetchRiskObject(
          incident.riskObjectId,
          user.companyId,
        );
        const description = this.buildIncidentDescription(relatedRules);
        const category = this.resolveCategory(relatedRules, categoryMap);
        const detectedAt = this.resolveDetectedAt(
          incidentFindings,
          relatedRules,
        );
        const severity = this.resolveIncidentSeverity(
          relatedRules,
          riskObject?.severity,
        );

        return {
          id: incident.id,
          riskObjectId: incident.riskObjectId,
          riskObjectName: riskObject?.name ?? incident.riskObjectId,
          incidentDescription: description,
          status: incident.status,
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? null,
          severity,
          detectedAt,
        };
      }),
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

  private buildIncidentDescription(rules: RuleDetailsResponse[]): string {
    const names = rules
      .map((rule) => rule.name?.trim())
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(', ') : 'Не определено';
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

  private resolveDetectedAt(
    findings: FindingOrmEntity[],
    rules: RuleDetailsResponse[],
  ): string | null {
    const dates = [
      ...findings
        .map((finding) => finding.detectedAt?.toISOString() ?? null)
        .filter((value): value is string => Boolean(value)),
      ...findings
        .map((finding) => this.extractFoundAt(finding.details))
        .filter((value): value is string => Boolean(value)),
      ...rules
        .map(
          (rule) => rule.detectedAt ?? rule.createdAt ?? rule.updatedAt ?? null,
        )
        .filter((value): value is string => Boolean(value)),
    ];
    if (dates.length === 0) {
      return null;
    }
    return dates.sort()[0] ?? null;
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
    const nearestRuleSeverity = this.scoreToSeverity(
      Math.round(ruleAverageScore),
    );

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

  private extractFoundAt(details: Record<string, unknown>): string | null {
    const foundAt = details.foundAt;
    return typeof foundAt === 'string' && foundAt.length > 0 ? foundAt : null;
  }

  private async fetchRiskObject(
    riskObjectId: string,
    companyId: string,
  ): Promise<RiskObjectResponse | null> {
    const monitoringServiceUrl = process.env.CMS_MONITORING_SERVICE_URL;
    if (!monitoringServiceUrl) {
      throw new BadRequestException(
        'CMS_MONITORING_SERVICE_URL is not configured',
      );
    }

    const url = `${monitoringServiceUrl}/api/internal/risk-objects/${riskObjectId}`;
    this.logger.log(`Risk API request: GET ${url} CompanyId=${companyId}`);
    const response = await fetch(
      url,
      {
        headers: {
          CompanyId: companyId,
        },
      },
    );
    this.logger.log(
      `Risk API response: GET ${url} status=${response.status} CompanyId=${companyId}`,
    );
    if (!response.ok) {
      const errorBody = await this.readErrorBody(response);
      this.logger.error(
        `Risk API error: GET ${url} status=${response.status} statusText=${response.statusText} body=${errorBody}`,
      );
      throw new BadRequestException(
        `Unable to fetch risk object: status ${response.status}`,
      );
    }
    return (await response.json()) as RiskObjectResponse;
  }

  private async fetchRules(
    ruleIds: string[],
  ): Promise<Map<string, RuleDetailsResponse>> {
    if (ruleIds.length === 0) {
      return new Map();
    }

    const riskServiceUrl = process.env.CMS_RISK_SERVICE_URL;
    if (!riskServiceUrl) {
      throw new BadRequestException('CMS_RISK_SERVICE_URL is not configured');
    }

    const responses = await Promise.all(
      ruleIds.map(async (ruleId) => {
        const url = `${riskServiceUrl}/api/internal/rules/${ruleId}`;
        this.logger.log(`Risk API request: GET ${url} ruleId=${ruleId}`);
        const response = await fetch(
          url,
        );
        this.logger.log(
          `Risk API response: GET ${url} status=${response.status} ruleId=${ruleId}`,
        );
        if (!response.ok) {
          const errorBody = await this.readErrorBody(response);
          this.logger.error(
            `Risk API error: GET ${url} status=${response.status} statusText=${response.statusText} body=${errorBody}`,
          );
          throw new BadRequestException(
            `Unable to fetch rule ${ruleId}: status ${response.status}`,
          );
        }
        const body = (await response.json()) as RuleDetailsResponse;
        return [ruleId, body] as const;
      }),
    );

    return new Map(responses);
  }

  private async fetchRiskCategories(
    companyId: string,
  ): Promise<Map<string, RiskCategoryItem>> {
    const riskServiceUrl = process.env.CMS_RISK_SERVICE_URL;
    if (!riskServiceUrl) {
      throw new BadRequestException('CMS_RISK_SERVICE_URL is not configured');
    }

    const url = `${riskServiceUrl}/api/internal/risk-categories`;
    this.logger.log(`Risk API request: GET ${url} CompanyId=${companyId}`);
    const response = await fetch(url, {
      headers: {
        CompanyId: companyId,
      },
    });
    this.logger.log(
      `Risk API response: GET ${url} status=${response.status} CompanyId=${companyId}`,
    );
    if (!response.ok) {
      const errorBody = await this.readErrorBody(response);
      this.logger.error(
        `Risk API error: GET ${url} status=${response.status} statusText=${response.statusText} body=${errorBody}`,
      );
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException(
          `Risk service authorization failed with status ${response.status}`,
        );
      }
      throw new BadRequestException(
        `Unable to fetch risk categories: status ${response.status}`,
      );
    }
    const body = (await response.json()) as { items?: RiskCategoryItem[] };
    return new Map((body.items ?? []).map((item) => [item.id, item]));
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

  private async readErrorBody(response: Response): Promise<string> {
    try {
      const bodyText = await response.text();
      return bodyText || '<empty>';
    } catch (error) {
      return `<unreadable: ${String(error)}>`;
    }
  }
}
