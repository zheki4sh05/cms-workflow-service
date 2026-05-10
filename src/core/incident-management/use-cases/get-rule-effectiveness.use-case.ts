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
import { Repository } from 'typeorm';
import { getOptionalEnvOrDefault } from '../../../web/app/env';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
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

interface RuleDetailsApiResponse {
  id?: string;
  name?: string;
  categoryId?: string | null;
  enabled?: boolean;
}

interface RiskCategoryItem {
  id: string;
  name: string;
}

export interface RuleEffectivenessItem {
  ruleId: string;
  ruleName: string;
  categoryId: string | null;
  categoryName: string | null;
  rejectedCount: number;
  closedCount: number;
  ruleActive: boolean;
}

export interface RuleEffectivenessResult {
  items: RuleEffectivenessItem[];
}

@Injectable({ scope: Scope.REQUEST })
export class GetRuleEffectivenessUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
  ) {}

  async execute(): Promise<RuleEffectivenessResult> {
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    const isExecutive = roles.includes('EXECUTIVE');
    const isSupervisor = roles.includes('SUPERVISOR');
    if (!isExecutive && !isSupervisor) {
      throw new ForbiddenException(
        'Only SUPERVISOR and EXECUTIVE can access rule effectiveness',
      );
    }

    const statuses = ['REJECTED', 'CLOSED'] as const;

    let rows: CaseOrmEntity[];

    if (isExecutive) {
      rows = await this.caseRepository
        .createQueryBuilder('c')
        .innerJoinAndSelect('c.finding', 'f')
        .innerJoin('c.incident', 'i')
        .where('i.companyId = :companyId', { companyId: user.companyId })
        .andWhere('c.status IN (:...statuses)', { statuses })
        .getMany();
    } else {
      const employeeId = this.resolveEmployeeIdForCompanyServices(user);
      const subordinates = await this.fetchDepartmentManagerSubordinates({
        userId: user.id,
        employeeId,
        companyId: user.companyId,
      });
      const subordinateUserIds = [...new Set(subordinates)];
      if (subordinateUserIds.length === 0) {
        return { items: [] };
      }

      rows = await this.caseRepository
        .createQueryBuilder('c')
        .innerJoinAndSelect('c.finding', 'f')
        .innerJoin('c.incident', 'i')
        .where('i.companyId = :companyId', { companyId: user.companyId })
        .andWhere('c.assignedUserId IN (:...ids)', { ids: subordinateUserIds })
        .andWhere('c.status IN (:...statuses)', { statuses })
        .getMany();
    }

    const aggregates = new Map<
      string,
      { rejectedCount: number; closedCount: number }
    >();

    for (const currentCase of rows) {
      const ruleId = this.extractRuleId(currentCase.finding);
      if (!ruleId) {
        continue;
      }
      let entry = aggregates.get(ruleId);
      if (!entry) {
        entry = { rejectedCount: 0, closedCount: 0 };
        aggregates.set(ruleId, entry);
      }
      if (currentCase.status === 'REJECTED') {
        entry.rejectedCount += 1;
      } else if (currentCase.status === 'CLOSED') {
        entry.closedCount += 1;
      }
    }

    const ruleIds = Array.from(aggregates.keys()).sort((a, b) => a.localeCompare(b));
    if (ruleIds.length === 0) {
      return { items: [] };
    }

    const categoryMap = await this.fetchRiskCategories(user.companyId);
    const ruleDetails = await this.fetchRules(ruleIds);

    const items: RuleEffectivenessItem[] = [];
    for (const ruleId of ruleIds) {
      const agg = aggregates.get(ruleId)!;
      const rule = ruleDetails.get(ruleId);
      const categoryId =
        typeof rule?.categoryId === 'string' && rule.categoryId.trim()
          ? rule.categoryId.trim()
          : null;
      const categoryName = categoryId
        ? categoryMap.get(categoryId)?.name ?? null
        : null;

      items.push({
        ruleId,
        ruleName: typeof rule?.name === 'string' && rule.name.trim() ? rule.name.trim() : '',
        categoryId,
        categoryName,
        rejectedCount: agg.rejectedCount,
        closedCount: agg.closedCount,
        ruleActive: rule?.enabled === true,
      });
    }

    items.sort((a, b) => {
      const byName = a.ruleName.localeCompare(b.ruleName, 'ru', {
        sensitivity: 'base',
      });
      if (byName !== 0) {
        return byName;
      }
      return a.ruleId.localeCompare(b.ruleId);
    });

    return { items };
  }

  private extractRuleId(finding: FindingOrmEntity): string | null {
    if (finding.rulesId?.trim()) {
      return finding.rulesId.trim();
    }
    const details = finding.details;
    const possibleRuleId =
      details.rulesId ?? details.ruleId ?? details.rules_id ?? null;
    return typeof possibleRuleId === 'string' && possibleRuleId.trim().length > 0
      ? possibleRuleId.trim()
      : null;
  }

  private async fetchRules(
    ruleIds: string[],
  ): Promise<Map<string, RuleDetailsApiResponse>> {
    const riskServiceUrl =
      process.env.CMS_RISK_SERVICE_URL?.trim() ?? 'http://localhost:9094';

    const responses = await Promise.all(
      ruleIds.map(async (ruleId) => {
        const response = await fetch(`${riskServiceUrl}/api/internal/rules/${ruleId}`);
        if (!response.ok) {
          return [ruleId, { id: ruleId, enabled: false }] as const;
        }
        const body = (await response.json()) as RuleDetailsApiResponse;
        return [ruleId, body] as const;
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

  private resolveEmployeeIdForCompanyServices(user: AuthUserDto): string {
    const fromHeader = this.request.header('EmployeeId')?.trim();
    const fromProfile = user.employeeId?.trim();
    const employeeId = fromHeader || fromProfile;
    if (!employeeId) {
      throw new BadRequestException(
        'EmployeeId header or profile employeeId is required for supervisor rule effectiveness',
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
