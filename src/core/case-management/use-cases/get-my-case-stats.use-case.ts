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
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';

interface AuthUserDto {
  id: string;
  employeeId?: string;
}

interface InternalUserDto {
  roles?: string[];
}

interface MyCaseStatsResult {
  total: number;
  ASSIGNED: number;
  ACTION_PLAN: number;
  OPEN: number;
  INVESTIGATING: number;
  WAITING_VERIFICATION: number;
  ACTION_IN_PROGRESS: number;
  IN_PROGRESS: number;
  REJECTED: number;
  CLOSED: number;
  avgResolutionTime: number;
}

@Injectable({ scope: Scope.REQUEST })
export class GetMyCaseStatsUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
  ) {}

  async execute(): Promise<MyCaseStatsResult> {
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    if (!roles.includes('MANAGER')) {
      return this.buildEmptyStats();
    }

    const assignedUserIds = [user.id, user.employeeId].filter(Boolean) as string[];
    if (assignedUserIds.length === 0) {
      return this.buildEmptyStats();
    }

    const cases = await this.caseRepository.find({
      where: assignedUserIds.map((assignedUserId) => ({
        assignedUserId,
      })),
      order: { id: 'ASC' },
    });
    if (cases.length === 0) {
      return this.buildEmptyStats();
    }

    const stats: MyCaseStatsResult = this.buildEmptyStats();
    stats.total = cases.length;

    for (const item of cases) {
      switch (item.status) {
        case 'ASSIGNED':
          stats.ASSIGNED += 1;
          break;
        case 'ACTION_PLAN':
          stats.ACTION_PLAN += 1;
          break;
        case 'OPEN':
          stats.OPEN += 1;
          break;
        case 'INVESTIGATING':
          stats.INVESTIGATING += 1;
          break;
        case 'WAITING_VERIFICATION':
          stats.WAITING_VERIFICATION += 1;
          break;
        case 'ACTION_IN_PROGRESS':
          stats.ACTION_IN_PROGRESS += 1;
          break;
        case 'IN_PROGRESS':
          stats.IN_PROGRESS += 1;
          break;
        case 'REJECTED':
          stats.REJECTED += 1;
          break;
        case 'CLOSED':
          stats.CLOSED += 1;
          break;
        default:
          break;
      }
    }

    stats.avgResolutionTime = await this.calculateAverageResolutionTime(cases);
    return stats;
  }

  private async calculateAverageResolutionTime(cases: CaseOrmEntity[]): Promise<number> {
    const closedCases = cases.filter((item) => item.status === 'CLOSED');
    if (closedCases.length === 0) {
      return 0;
    }

    const findingIds = Array.from(new Set(closedCases.map((item) => item.findingId)));
    const incidentIds = Array.from(new Set(closedCases.map((item) => item.incidentId)));

    const [findings, incidents] = await Promise.all([
      this.findingRepository.find({
        where: { id: In(findingIds) },
      }),
      this.incidentRepository.find({
        where: { id: In(incidentIds) },
      }),
    ]);

    const findingById = new Map(findings.map((item) => [item.id, item]));
    const incidentById = new Map(incidents.map((item) => [item.id, item]));

    const values: number[] = [];
    for (const item of closedCases) {
      const finding = findingById.get(item.findingId);
      const incident = incidentById.get(item.incidentId);
      if (!finding || !incident?.resolvedDate) {
        continue;
      }

      const detectedAt = finding.detectedAt ?? this.parseDateFromUnknown(finding.details.foundAt);
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

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.round(average);
  }

  private parseDateFromUnknown(value: unknown): Date | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private buildEmptyStats(): MyCaseStatsResult {
    return {
      total: 0,
      ASSIGNED: 0,
      ACTION_PLAN: 0,
      OPEN: 0,
      INVESTIGATING: 0,
      WAITING_VERIFICATION: 0,
      ACTION_IN_PROGRESS: 0,
      IN_PROGRESS: 0,
      REJECTED: 0,
      CLOSED: 0,
      avgResolutionTime: 0,
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
}
