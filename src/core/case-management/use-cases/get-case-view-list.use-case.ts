import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { InvestigationOrmEntity } from '../../../infrastructure/investigation-management/persistence/investigation.orm-entity';

interface AuthUserDto {
  id: string;
}

interface InternalUserDto {
  roles?: string[];
}

interface RuleDetailsResponse {
  name?: string;
  condition?: string;
  ruleCondition?: string;
}

interface CaseViewListItem {
  ruleId: string | null;
  ruleName: string | null;
  ruleCondition: string | null;
  details: Record<string, unknown>;
  investigationNotes: string | null;
  rootCause: string | null;
  requiresCorrectiveAction: boolean | null;
  updatedAt: Date | null;
}

@Injectable({ scope: Scope.REQUEST })
export class GetCaseViewListUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
    @InjectRepository(InvestigationOrmEntity)
    private readonly investigationRepository: Repository<InvestigationOrmEntity>,
  ) {}

  async execute(caseId: string): Promise<CaseViewListItem> {
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    if (!roles.includes('MANAGER')) {
      throw new UnauthorizedException('Only MANAGER role is supported');
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    const finding = await this.findingRepository.findOne({
      where: { id: currentCase.findingId },
    });
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    const rules = await this.fetchRules(
      finding.rulesId ? [finding.rulesId] : [],
    );
    const ruleId = finding.rulesId ?? null;
    const rule = ruleId ? rules.get(ruleId) : null;
    const investigation = await this.investigationRepository.findOne({
      where: { caseId: currentCase.id },
    });

    return {
      ruleId,
      ruleName: rule?.name ?? null,
      ruleCondition: rule?.condition ?? rule?.ruleCondition ?? null,
      details: finding.details,
      investigationNotes: investigation?.investigationNotes ?? null,
      rootCause: investigation?.rootCause ?? null,
      requiresCorrectiveAction: investigation?.requiresCorrectiveAction ?? null,
      updatedAt: investigation?.updatedAt ?? null,
    };
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

    return { id: user.id };
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
