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
import { Brackets, In, Repository } from 'typeorm';
import { VerificationOrmEntity } from '../../../infrastructure/action-plan-management/persistence/verification.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';

interface AuthUserDto {
  id: string;
  companyId: string;
  employeeId: string;
}

interface InternalUserDto {
  roles?: string[];
}

interface InternalAssigneeProfileResponse {
  id?: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  user?: {
    id?: string;
    employeeId?: string;
    firstName?: string;
    lastName?: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface PendingVerificationResponsible {
  userId: string | null;
  employeeId: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface PendingVerificationListItem {
  actionPlanId: string;
  incidentId: string;
  documentTitle: string | null;
  responsible: PendingVerificationResponsible;
  incidentReceivedAt: string | null;
}

export interface PendingVerificationListResult {
  items: PendingVerificationListItem[];
}

@Injectable({ scope: Scope.REQUEST })
export class GetPendingVerificationsListUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(VerificationOrmEntity)
    private readonly verificationRepository: Repository<VerificationOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
  ) {}

  async execute(): Promise<PendingVerificationListResult> {
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    const isExecutive = roles.includes('EXECUTIVE');
    const isSupervisor = roles.includes('SUPERVISOR');
    if (!isExecutive && !isSupervisor) {
      throw new ForbiddenException(
        'Only SUPERVISOR and EXECUTIVE can list pending verifications',
      );
    }

    const qb = this.verificationRepository
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.actionPlan', 'ap')
      .innerJoinAndSelect('ap.case', 'c')
      .innerJoinAndSelect('ap.incident', 'i')
      .innerJoinAndSelect('c.finding', 'f')
      .where('v.verified = :verified', { verified: false })
      .andWhere('c.status = :caseStatus', { caseStatus: 'WAITING_VERIFICATION' })
      .andWhere('i.companyId = :companyId', { companyId: user.companyId });

    if (!isExecutive) {
      const eid = user.employeeId?.trim() ?? '';
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('v.assignedUserForVerification = :userId', {
            userId: user.id,
          });
          if (eid.length > 0) {
            sub.orWhere('v.assignedEmployeeForVerification = :employeeId', {
              employeeId: eid,
            });
          }
        }),
      );
    }

    qb.orderBy('ap.id', 'ASC');

    const rows = await qb.getMany();

    const incidentIds = Array.from(
      new Set(
        rows
          .map((row) => row.actionPlan?.incidentId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const findingsByIncident =
      incidentIds.length === 0
        ? new Map<string, FindingOrmEntity[]>()
        : await this.loadFindingsGroupedByIncident(incidentIds);

    const assigneeIds = Array.from(
      new Set(
        rows
          .map((row) => row.actionPlan?.case?.assignedUserId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const assigneeById = await this.fetchAssigneeProfiles(assigneeIds);

    const items: PendingVerificationListItem[] = [];
    for (const row of rows) {
      const plan = row.actionPlan;
      const currentCase = plan?.case;
      const incident = plan?.incident;
      const finding = currentCase?.finding;
      if (!plan || !currentCase || !incident || !finding) {
        continue;
      }

      const incidentFindings = findingsByIncident.get(incident.id) ?? [finding];
      const documentTitle = this.resolveDocumentTitleFromFindings(incidentFindings);
      const receivedAt = this.resolveEarliestReceivedAt(incidentFindings);
      const rawAssigneeId = currentCase.assignedUserId?.trim() ?? null;
      const profile = rawAssigneeId ? assigneeById.get(rawAssigneeId) : undefined;

      items.push({
        actionPlanId: plan.id,
        incidentId: incident.id,
        documentTitle,
        responsible: this.mapResponsible(profile, rawAssigneeId),
        incidentReceivedAt: receivedAt,
      });
    }

    return { items };
  }

  private mapResponsible(
    profile: InternalAssigneeProfileResponse | undefined,
    assigneeKey: string | null,
  ): PendingVerificationResponsible {
    if (!assigneeKey) {
      return {
        userId: null,
        employeeId: null,
        firstName: null,
        lastName: null,
      };
    }
    if (!profile) {
      return {
        userId: assigneeKey,
        employeeId: null,
        firstName: null,
        lastName: null,
      };
    }
    const nested = profile.user ?? {};
    const resolvedUserId =
      typeof profile.id === 'string' && profile.id.trim()
        ? profile.id.trim()
        : typeof nested.id === 'string' && nested.id.trim()
          ? nested.id.trim()
          : assigneeKey;
    const resolvedEmployeeId =
      typeof profile.employeeId === 'string' && profile.employeeId.trim()
        ? profile.employeeId.trim()
        : typeof nested.employeeId === 'string' && nested.employeeId.trim()
          ? nested.employeeId.trim()
          : null;
    const firstName =
      profile.firstName ??
      profile.first_name ??
      nested.firstName ??
      nested.first_name ??
      null;
    const lastName =
      profile.lastName ??
      profile.last_name ??
      nested.lastName ??
      nested.last_name ??
      null;

    return {
      userId: resolvedUserId,
      employeeId: resolvedEmployeeId,
      firstName: typeof firstName === 'string' ? firstName : null,
      lastName: typeof lastName === 'string' ? lastName : null,
    };
  }

  private async loadFindingsGroupedByIncident(
    incidentIds: string[],
  ): Promise<Map<string, FindingOrmEntity[]>> {
    const findings = await this.findingRepository.find({
      where: { incidentId: In(incidentIds) },
    });
    return this.groupBy(findings, (f) => f.incidentId);
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

  private resolveDocumentTitleFromFindings(findings: FindingOrmEntity[]): string | null {
    for (const f of findings) {
      const title = this.resolveDocumentTitle(f.details);
      if (title) {
        return title;
      }
    }
    return null;
  }

  private resolveDocumentTitle(details: Record<string, unknown>): string | null {
    const candidates = [
      details.documentTitle,
      details.title,
      details.documentName,
      details.fileName,
      details.name,
      details.document_title,
    ];
    for (const value of candidates) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return null;
  }

  /** Минимальная дата обнаружения среди findings инцидента. */
  private resolveEarliestReceivedAt(findings: FindingOrmEntity[]): string | null {
    let earliest: Date | null = null;
    for (const finding of findings) {
      const fromFinding = finding.detectedAt;
      const fromDetails = this.parseDateFromUnknown(finding.details.foundAt);
      const candidate = fromFinding ?? fromDetails;
      if (!candidate || Number.isNaN(candidate.getTime())) {
        continue;
      }
      if (!earliest || candidate.getTime() < earliest.getTime()) {
        earliest = candidate;
      }
    }
    return earliest ? earliest.toISOString() : null;
  }

  private parseDateFromUnknown(value: unknown): Date | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private async fetchAssigneeProfiles(
    userIds: string[],
  ): Promise<Map<string, InternalAssigneeProfileResponse>> {
    const result = new Map<string, InternalAssigneeProfileResponse>();
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
      userIds.map(async (id) => {
        const response = await fetch(`${authServiceUrl}/api/internal/users/${id}`, {
          headers: { authorization },
        });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as InternalAssigneeProfileResponse;
        result.set(id, body);
      }),
    );
    return result;
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
