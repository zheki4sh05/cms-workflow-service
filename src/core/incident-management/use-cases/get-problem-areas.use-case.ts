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
import { In, IsNull, Not, Repository } from 'typeorm';
import { getOptionalEnvOrDefault } from '../../../web/app/env';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { GetIncidentReportUseCase } from './get-incident-report.use-case';

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

export interface ProblemAreasGroupResult {
  documentId: string;
  incidentCount: number;
  incidents: unknown[];
}

export interface ProblemAreasResult {
  month: string;
  groups: ProblemAreasGroupResult[];
}

@Injectable({ scope: Scope.REQUEST })
export class GetProblemAreasUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    private readonly getIncidentReportUseCase: GetIncidentReportUseCase,
  ) {}

  async execute(monthQuery?: string): Promise<ProblemAreasResult> {
    const month = this.normalizeMonth(monthQuery);
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);

    const isExecutive = roles.includes('EXECUTIVE');
    const isSupervisor = roles.includes('SUPERVISOR');
    if (!isExecutive && !isSupervisor) {
      throw new ForbiddenException(
        'Only SUPERVISOR and EXECUTIVE can access problem areas',
      );
    }

    let incidents: IncidentOrmEntity[];

    if (isExecutive) {
      incidents = await this.incidentRepository.find({
        where: {
          companyId: user.companyId,
          documentId: Not(IsNull()),
        },
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
        return { month, groups: [] };
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
        return { month, groups: [] };
      }

      incidents = await this.incidentRepository.find({
        where: {
          id: In(incidentIds),
          companyId: user.companyId,
          documentId: Not(IsNull()),
        },
      });
    }

    incidents = incidents.filter(
      (inc) => typeof inc.documentId === 'string' && inc.documentId.trim().length > 0,
    );

    if (incidents.length === 0) {
      return { month, groups: [] };
    }

    const findings = await this.findingRepository.find({
      where: { incidentId: In(incidents.map((i) => i.id)) },
    });
    const findingsByIncidentId = this.groupBy(findings, (f) => f.incidentId);

    /** documentId → incident ids попавших в выбранный месяц */
    const docToIncidentIds = new Map<string, Set<string>>();
    for (const inc of incidents) {
      const docKey = inc.documentId!.trim();
      const incFindings = findingsByIncidentId.get(inc.id) ?? [];
      const incidentMonth = this.resolveIncidentUtcYearMonth(incFindings);
      if (!incidentMonth || incidentMonth !== month) {
        continue;
      }
      let set = docToIncidentIds.get(docKey);
      if (!set) {
        set = new Set();
        docToIncidentIds.set(docKey, set);
      }
      set.add(inc.id);
    }

    const problemDocumentIds = Array.from(docToIncidentIds.entries())
      .filter(([, idSet]) => idSet.size > 1)
      .map(([docId]) => docId)
      .sort((a, b) => a.localeCompare(b));

    const groups: ProblemAreasGroupResult[] = [];

    for (const documentId of problemDocumentIds) {
      const idSet = docToIncidentIds.get(documentId)!;
      const sortedIds = Array.from(idSet).sort();
      const reports = await Promise.all(
        sortedIds.map((id) => this.getIncidentReportUseCase.execute(id)),
      );
      groups.push({
        documentId,
        incidentCount: reports.length,
        incidents: reports,
      });
    }

    return { month, groups };
  }

  private normalizeMonth(raw?: string): string {
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      return this.formatUtcYearMonth(new Date());
    }
    const trimmed = String(raw).trim();
    const match = /^(\d{4})-(\d{2})$/.exec(trimmed);
    if (!match) {
      throw new BadRequestException('month must be in YYYY-MM format (UTC calendar month)');
    }
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (m < 1 || m > 12 || y < 1970 || y > 2100) {
      throw new BadRequestException('Invalid month value');
    }
    return `${match[1]}-${match[2]}`;
  }

  private formatUtcYearMonth(d: Date): string {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    return `${y}-${m < 10 ? `0${m}` : String(m)}`;
  }

  /** Календарный месяц UTC по самой ранней дате обнаружения среди findings. */
  private resolveIncidentUtcYearMonth(findings: FindingOrmEntity[]): string | null {
    let earliest: Date | null = null;
    for (const finding of findings) {
      const fromFinding = finding.detectedAt ?? null;
      const fromDetails = this.parseDateFromUnknown(finding.details.foundAt);
      const candidate = fromFinding ?? fromDetails;
      if (!candidate || Number.isNaN(candidate.getTime())) {
        continue;
      }
      if (!earliest || candidate.getTime() < earliest.getTime()) {
        earliest = candidate;
      }
    }
    return earliest ? this.formatUtcYearMonth(earliest) : null;
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

  private resolveEmployeeIdForCompanyServices(user: AuthUserDto): string {
    const fromHeader = this.request.header('EmployeeId')?.trim();
    const fromProfile = user.employeeId?.trim();
    const employeeId = fromHeader || fromProfile;
    if (!employeeId) {
      throw new BadRequestException(
        'EmployeeId header or profile employeeId is required for supervisor problem areas',
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
