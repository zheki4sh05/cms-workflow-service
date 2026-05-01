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
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';

interface AuthUserDto {
  id: string;
  employeeId?: string;
}

interface InternalUserDto {
  roles?: string[];
}

interface RuleDetailsResponse {
  name?: string;
}

interface MyCaseListItem {
  caseId: string;
  ruleId: string | null;
  ruleName: string | null;
  priority: string;
  status: string;
  deadline: Date | null;
}

@Injectable({ scope: Scope.REQUEST })
export class GetMyCaseListUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
  ) {}

  async execute(): Promise<MyCaseListItem[]> {
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    if (!roles.includes('MANAGER')) {
      return [];
    }

    const assignedUserIds = [user.id, user.employeeId].filter(Boolean) as string[];
    if (assignedUserIds.length === 0) {
      return [];
    }

    const cases = await this.caseRepository.find({
      where: assignedUserIds.map((assignedUserId) => ({
        assignedUserId,
      })),
      order: { id: 'ASC' },
    });
    if (cases.length === 0) {
      return [];
    }

    const findingIds = Array.from(new Set(cases.map((item) => item.findingId)));
    const findings = await this.findingRepository.find({
      where: { id: In(findingIds) },
    });
    const findingsById = new Map(findings.map((item) => [item.id, item]));

    const ruleIds = Array.from(
      new Set(
        findings
          .map((item) => item.rulesId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const ruleMap = await this.fetchRules(ruleIds);

    return cases.map((item) => {
      const finding = findingsById.get(item.findingId);
      const ruleId = finding?.rulesId ?? null;
      const rule = ruleId ? ruleMap.get(ruleId) : null;

      return {
        caseId: item.id,
        ruleId,
        ruleName: rule?.name ?? null,
        priority: finding?.priority ?? 'UNKNOWN',
        status: item.status,
        deadline: finding?.deadline ?? null,
      };
    });
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
    if (!user.id) {
      throw new UnauthorizedException('Invalid user payload');
    }

    return user as AuthUserDto;
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
          return [ruleId, {}] as const;
        }
        const body = (await response.json()) as RuleDetailsResponse;
        return [ruleId, body] as const;
      }),
    );

    return new Map(responses);
  }
}
