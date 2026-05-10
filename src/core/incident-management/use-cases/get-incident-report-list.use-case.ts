import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { FindOptionsWhere, In, Like, Repository } from 'typeorm';
import { getOptionalEnvOrDefault } from '../../../web/app/env';
import {
  IncidentOrmEntity,
  IncidentStatus,
} from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { InvestigationOrmEntity } from '../../../infrastructure/investigation-management/persistence/investigation.orm-entity';
import { CaseCommentOrmEntity } from '../../../infrastructure/case-management/persistence/case-comment.orm-entity';
import { CaseAttachmentOrmEntity } from '../../../infrastructure/case-management/persistence/case-attachment.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { VerificationOrmEntity } from '../../../infrastructure/action-plan-management/persistence/verification.orm-entity';
import { ActionPlanTaskEvidenceOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task-evidence.orm-entity';

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

interface IntegrationConfigResponse {
  number?: number;
  name?: string;
}

interface RuleDetailsResponse {
  name?: string;
}

interface RiskObjectResponse {
  id: string;
  name?: string;
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

interface PaginatedIncidentReport {
  items: unknown[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface IncidentReportFilters {
  incidentId?: string;
  documentId?: string;
  status?: string;
}

@Injectable({ scope: Scope.REQUEST })
export class GetIncidentReportListUseCase {
  private readonly logger = new Logger(GetIncidentReportListUseCase.name);
  private static readonly EXTERNAL_CACHE_TTL_MS = 2 * 60 * 1000;
  private static readonly EXTERNAL_CACHE_MAX_ITEMS = 10;
  private static readonly externalCache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(InvestigationOrmEntity)
    private readonly investigationRepository: Repository<InvestigationOrmEntity>,
    @InjectRepository(CaseCommentOrmEntity)
    private readonly caseCommentRepository: Repository<CaseCommentOrmEntity>,
    @InjectRepository(CaseAttachmentOrmEntity)
    private readonly caseAttachmentRepository: Repository<CaseAttachmentOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(VerificationOrmEntity)
    private readonly verificationRepository: Repository<VerificationOrmEntity>,
    @InjectRepository(ActionPlanTaskEvidenceOrmEntity)
    private readonly taskEvidenceRepository: Repository<ActionPlanTaskEvidenceOrmEntity>,
  ) {}

  async execute(
    page: number,
    limit: number,
    filters: IncidentReportFilters = {},
  ): Promise<PaginatedIncidentReport> {
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);

    const isExecutive = roles.includes('EXECUTIVE');
    const isExecutor = roles.includes('EXECUTOR');
    const isSupervisor = roles.includes('SUPERVISOR');
    const companyWide = isExecutive || isExecutor;
    if (!companyWide && !isSupervisor) {
      throw new ForbiddenException(
        'Only SUPERVISOR, EXECUTIVE and EXECUTOR can access incident reports',
      );
    }

    const normalizedPage = this.normalizePage(page);
    const normalizedLimit = this.normalizeLimit(limit);

    if (companyWide) {
      return this.buildExecutivePage(
        user.companyId,
        normalizedPage,
        normalizedLimit,
        filters,
      );
    }

    return this.buildSupervisorPage(user, normalizedPage, normalizedLimit, filters);
  }

  private async buildExecutivePage(
    companyId: string,
    page: number,
    limit: number,
    filters: IncidentReportFilters,
  ): Promise<PaginatedIncidentReport> {
    const where = this.buildIncidentWhere({ companyId, filters });
    const total = await this.incidentRepository.count({
      where,
    });

    if (total === 0) {
      return this.buildEmptyPage(page, limit);
    }

    const incidents = await this.incidentRepository.find({
      where,
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const items = await this.buildReportsForIncidents(incidents);
    return this.buildPageResult(items, page, limit, total);
  }

  private async buildSupervisorPage(
    user: AuthUserDto,
    page: number,
    limit: number,
    filters: IncidentReportFilters,
  ): Promise<PaginatedIncidentReport> {
    const employeeId = this.resolveEmployeeIdForCompanyServices(user);
    const subordinates = await this.fetchDepartmentManagerSubordinates({
      userId: user.id,
      employeeId,
      companyId: user.companyId,
    });
    const subordinateUserIds = [...new Set(subordinates)];

    if (subordinateUserIds.length === 0) {
      return this.buildEmptyPage(page, limit);
    }

    const [cases, findings] = await Promise.all([
      this.caseRepository.find({
        where: subordinateUserIds.map((assignedUserId) => ({ assignedUserId })),
      }),
      this.findingRepository.find({
        where: subordinateUserIds.map((assignedUserId) => ({ assignedUserId })),
      }),
    ]);

    const incidentIds = [
      ...new Set([
        ...cases.map((item) => item.incidentId),
        ...findings.map((item) => item.incidentId),
      ]),
    ];
    if (incidentIds.length === 0) {
      return this.buildEmptyPage(page, limit);
    }

    const requestedIncidentId = filters.incidentId?.trim();
    if (requestedIncidentId && !incidentIds.includes(requestedIncidentId)) {
      return this.buildEmptyPage(page, limit);
    }

    const where = this.buildIncidentWhere({
      companyId: user.companyId,
      availableIncidentIds: incidentIds,
      filters,
    });
    const total = await this.incidentRepository.count({
      where,
    });
    if (total === 0) {
      return this.buildEmptyPage(page, limit);
    }

    const paginatedIncidents = await this.incidentRepository.find({
      where,
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const items = await this.buildReportsForIncidents(paginatedIncidents);
    return this.buildPageResult(items, page, limit, total);
  }

  private buildIncidentWhere(params: {
    companyId: string;
    availableIncidentIds?: string[];
    filters: IncidentReportFilters;
  }): FindOptionsWhere<IncidentOrmEntity> {
    const where: FindOptionsWhere<IncidentOrmEntity> = {
      companyId: params.companyId,
    };

    if (params.availableIncidentIds?.length) {
      where.id = In(params.availableIncidentIds);
    }

    const incidentId = params.filters.incidentId?.trim();
    if (incidentId) {
      where.id = incidentId;
    }

    const documentId = params.filters.documentId?.trim();
    if (documentId) {
      where.documentId = Like(`%${documentId}%`);
    }

    const status = params.filters.status?.trim();
    if (status) {
      where.status = this.normalizeIncidentStatus(status);
    }

    return where;
  }

  private normalizeIncidentStatus(status: string): IncidentStatus {
    const normalized = status.toUpperCase();
    const allowed: IncidentStatus[] = [
      'OPEN',
      'PARTLY_PROGRESS',
      'IN_PROGRESS',
      'RESOLVED',
    ];
    if (allowed.includes(normalized as IncidentStatus)) {
      return normalized as IncidentStatus;
    }

    throw new BadRequestException(
      `Invalid incident status filter: ${status}. Allowed: ${allowed.join(', ')}`,
    );
  }

  private async buildReportsForIncidents(incidents: IncidentOrmEntity[]) {
    if (incidents.length === 0) {
      return [];
    }

    const incidentIds = incidents.map((incident) => incident.id);
    const findings = await this.findingRepository.find({
      where: { incidentId: In(incidentIds) },
      order: { id: 'ASC' },
    });
    const findingIds = findings.map((item) => item.id);
    const ruleIds = Array.from(
      new Set(
        findings
          .map((item) => this.extractRuleId(item))
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const cases = await this.caseRepository.find({
      where: { incidentId: In(incidentIds) },
      order: { id: 'ASC' },
    });
    const caseIds = cases.map((item) => item.id);

    const investigations = caseIds.length
      ? await this.investigationRepository.find({
          where: { caseId: In(caseIds) },
          order: { createdAt: 'ASC' },
        })
      : [];
    const caseComments = caseIds.length
      ? await this.caseCommentRepository.find({
          where: { caseId: In(caseIds) },
          order: { time: 'ASC' },
        })
      : [];
    const caseAttachments = caseIds.length
      ? await this.caseAttachmentRepository.find({
          where: { caseId: In(caseIds) },
          order: { time: 'ASC' },
        })
      : [];
    const actionPlans = caseIds.length
      ? await this.actionPlanRepository.find({
          where: { caseId: In(caseIds) },
          order: { id: 'ASC' },
        })
      : [];
    const actionPlanIds = actionPlans.map((item) => item.id);
    const tasks = actionPlanIds.length
      ? await this.actionPlanTaskRepository.find({
          where: { actionPlanId: In(actionPlanIds) },
          order: { dueDate: 'ASC' },
        })
      : [];
    const taskIds = tasks.map((item) => item.id);
    const verifications = actionPlanIds.length
      ? await this.verificationRepository.find({
          where: { actionPlanId: In(actionPlanIds) },
          order: { id: 'ASC' },
        })
      : [];
    const taskEvidences = taskIds.length
      ? await this.taskEvidenceRepository.find({
          where: { taskId: In(taskIds) },
          order: { time: 'ASC' },
        })
      : [];

    const [integrationMap, ruleMap, riskObjectMap, assigneeMap] = await Promise.all([
      this.fetchIntegrationMap(incidents),
      this.fetchRules(ruleIds),
      this.fetchRiskObjectMap(incidents),
      this.fetchUserNamesById([
        ...findings.map((finding) => finding.assignedUserId),
        ...caseComments.map((comment) => comment.userId),
        ...caseAttachments.map((attachment) => attachment.userId),
      ]),
    ]);

    const findingsByIncidentId = this.groupBy(findings, (item) => item.incidentId);
    const casesByFindingId = this.groupBy(
      cases.filter((item) => findingIds.includes(item.findingId)),
      (item) => item.findingId,
    );
    const investigationsByCaseId = new Map(
      investigations.map((item) => [item.caseId, item]),
    );
    const commentsByCaseId = this.groupBy(caseComments, (item) => item.caseId);
    const attachmentsByCaseId = this.groupBy(caseAttachments, (item) => item.caseId);
    const actionPlansByCaseId = this.groupBy(actionPlans, (item) => item.caseId);
    const tasksByActionPlanId = this.groupBy(tasks, (item) => item.actionPlanId);
    const verificationByActionPlanId = new Map(
      verifications.map((item) => [item.actionPlanId, item]),
    );
    const evidencesByTaskId = this.groupBy(taskEvidences, (item) => item.taskId);

    return incidents.map((incident) => ({
      incident: {
        id: incident.id,
        companyId: incident.companyId,
        integrationId: incident.integrationId,
        integrationName: integrationMap.get(incident.integrationId) ?? null,
        riskObjectId: incident.riskObjectId,
        riskObjectName: riskObjectMap.get(incident.riskObjectId) ?? null,
        documentId: incident.documentId ?? null,
        status: incident.status,
      },
      findings: (findingsByIncidentId.get(incident.id) ?? []).map((finding) => ({
        id: finding.id,
        priority: finding.priority,
        assignedUserId: finding.assignedUserId,
        ruleName: this.resolveRuleName(finding, ruleMap),
        firstName: this.resolveFirstName(finding.assignedUserId, assigneeMap),
        lastName: this.resolveLastName(finding.assignedUserId, assigneeMap),
        details: finding.details,
        cases: (casesByFindingId.get(finding.id) ?? []).map((currentCase) => {
          const actionPlan = (actionPlansByCaseId.get(currentCase.id) ?? [])[0];
          return {
            id: currentCase.id,
            incidentId: currentCase.incidentId,
            findingId: currentCase.findingId,
            assignedUserId: currentCase.assignedUserId,
            status: currentCase.status,
            investigation: this.mapInvestigation(
              investigationsByCaseId.get(currentCase.id),
            ),
            comments: (commentsByCaseId.get(currentCase.id) ?? []).map(
              (comment) => ({
                id: comment.id,
                userId: comment.userId,
                firstName: this.resolveFirstName(comment.userId, assigneeMap),
                lastName: this.resolveLastName(comment.userId, assigneeMap),
                comment: comment.comment,
                time: comment.time,
              }),
            ),
            attachments: (attachmentsByCaseId.get(currentCase.id) ?? []).map(
              (attachment) => ({
                id: attachment.id,
                userId: attachment.userId,
                firstName: this.resolveFirstName(attachment.userId, assigneeMap),
                lastName: this.resolveLastName(attachment.userId, assigneeMap),
                fileId: attachment.fileId,
                name: attachment.name,
                size: attachment.size,
                time: attachment.time,
              }),
            ),
            actionPlan: actionPlan
              ? {
                  id: actionPlan.id,
                  incidentId: actionPlan.incidentId,
                  caseId: actionPlan.caseId,
                  title: actionPlan.title,
                  description: actionPlan.description,
                  comment: actionPlan.comment,
                  verification: this.mapVerification(
                    verificationByActionPlanId.get(actionPlan.id),
                  ),
                  tasks: (tasksByActionPlanId.get(actionPlan.id) ?? []).map(
                    (task) => ({
                      id: task.id,
                      title: task.title,
                      description: task.description,
                      priority: task.priority,
                      dueDate: task.dueDate,
                      status: task.status,
                      evidenceDescriptionInprogress:
                        task.evidenceDescriptionInprogress,
                      evidenceDescriptionDone: task.evidenceDescriptionDone,
                      completedAt: task.completedAt,
                      evidences: (evidencesByTaskId.get(task.id) ?? []).map(
                        (evidence) => ({
                          id: evidence.id,
                          userId: evidence.userId,
                          fileId: evidence.fileId,
                          name: evidence.name,
                          time: evidence.time,
                        }),
                      ),
                    }),
                  ),
                }
              : null,
          };
        }),
      })),
    }));
  }

  private mapInvestigation(investigation?: InvestigationOrmEntity) {
    if (!investigation) {
      return null;
    }
    return {
      id: investigation.id,
      caseId: investigation.caseId,
      investigationNotes: investigation.investigationNotes,
      rootCause: investigation.rootCause,
      requiresCorrectiveAction: investigation.requiresCorrectiveAction,
      createdAt: investigation.createdAt,
      updatedAt: investigation.updatedAt,
    };
  }

  private mapVerification(verification?: VerificationOrmEntity) {
    if (!verification) {
      return null;
    }
    return {
      id: verification.id,
      actionPlanId: verification.actionPlanId,
      verified: verification.verified,
      assignedUserForVerification: verification.assignedUserForVerification,
      assignedEmployeeForVerification:
        verification.assignedEmployeeForVerification,
      comments: verification.comments,
    };
  }

  private buildPageResult(
    items: unknown[],
    page: number,
    limit: number,
    total: number,
  ): PaginatedIncidentReport {
    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  private buildEmptyPage(page: number, limit: number): PaginatedIncidentReport {
    return {
      items: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    };
  }

  private normalizePage(page: number): number {
    if (!Number.isFinite(page) || page < 1) {
      return 1;
    }
    return Math.floor(page);
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit < 1) {
      return 10;
    }
    return Math.min(Math.floor(limit), 100);
  }

  private resolveEmployeeIdForCompanyServices(user: AuthUserDto): string {
    const fromHeader = this.request.header('EmployeeId')?.trim();
    const fromProfile = user.employeeId?.trim();
    const employeeId = fromHeader || fromProfile;
    if (!employeeId) {
      throw new BadRequestException(
        'EmployeeId header or profile employeeId is required for supervisor reports',
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
    this.logger.log(`Company-info request: GET ${url}`);

    const response = await fetch(url, {
      headers: { authorization },
    });
    this.logger.log(
      `Company-info response: GET ${url} status=${response.status}`,
    );

    if (!response.ok) {
      const errorBody = await this.readErrorBody(response);
      this.logger.error(
        `Company-info error: GET ${url} status=${response.status} body=${errorBody}`,
      );
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

  private async fetchIntegrationMap(
    incidents: IncidentOrmEntity[],
  ): Promise<Map<number, string>> {
    const byCompany = this.groupBy(incidents, (item) => item.companyId);
    const pairs = await Promise.all(
      Array.from(byCompany.entries()).flatMap(([companyId, companyIncidents]) => {
        const integrationIds = Array.from(
          new Set(companyIncidents.map((item) => item.integrationId)),
        );
        return integrationIds.map(async (integrationId) => {
          const integration = await this.fetchIntegrationConfig(
            integrationId,
            companyId,
          );
          return [
            integrationId,
            integration.name ?? String(integration.number ?? integrationId),
          ] as const;
        });
      }),
    );

    return new Map(pairs);
  }

  private async fetchRiskObjectMap(
    incidents: IncidentOrmEntity[],
  ): Promise<Map<string, string>> {
    const byCompany = this.groupBy(incidents, (item) => item.companyId);
    const pairs = await Promise.all(
      Array.from(byCompany.entries()).flatMap(([companyId, companyIncidents]) => {
        const riskObjectIds = Array.from(
          new Set(companyIncidents.map((item) => item.riskObjectId)),
        );
        return riskObjectIds.map(async (riskObjectId) => {
          const riskObject = await this.fetchRiskObject(riskObjectId, companyId);
          return [riskObjectId, riskObject.name ?? riskObjectId] as const;
        });
      }),
    );

    return new Map(pairs);
  }

  private async fetchRiskObject(
    riskObjectId: string,
    companyId: string,
  ): Promise<RiskObjectResponse> {
    const monitoringServiceUrl = process.env.CMS_MONITORING_SERVICE_URL?.trim();
    if (!monitoringServiceUrl) {
      throw new BadRequestException('CMS_MONITORING_SERVICE_URL is not configured');
    }

    return this.readThroughExternalCache<RiskObjectResponse>(
      `risk-object:${companyId}:${riskObjectId}`,
      async () => {
        const response = await fetch(
          `${monitoringServiceUrl}/api/internal/risk-objects/${riskObjectId}`,
          {
            headers: {
              CompanyId: companyId,
            },
          },
        );
        if (!response.ok) {
          const errorBody = await this.readErrorBody(response);
          throw new BadRequestException(
            `Unable to fetch risk object: status ${response.status}${errorBody ? `, body: ${errorBody}` : ''}`,
          );
        }

        return (await response.json()) as RiskObjectResponse;
      },
    );
  }

  private async fetchIntegrationConfig(
    integrationId: number,
    companyId: string,
  ): Promise<IntegrationConfigResponse> {
    const monitoringServiceUrl = process.env.CMS_MONITORING_SERVICE_URL?.trim();
    if (!monitoringServiceUrl) {
      throw new BadRequestException('CMS_MONITORING_SERVICE_URL is not configured');
    }

    return this.readThroughExternalCache<IntegrationConfigResponse>(
      `integration-config:${companyId}:${integrationId}`,
      async () => {
        const response = await fetch(
          `${monitoringServiceUrl}/api/internal/integration-configs/${integrationId}`,
          {
            headers: {
              CompanyId: companyId,
            },
          },
        );
        if (!response.ok) {
          const errorBody = await this.readErrorBody(response);
          throw new BadRequestException(
            `Unable to fetch integration config: status ${response.status}${errorBody ? `, body: ${errorBody}` : ''}`,
          );
        }

        return (await response.json()) as IntegrationConfigResponse;
      },
    );
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
        const body = await this.readThroughExternalCache<RuleDetailsResponse>(
          `risk-rule:${ruleId}`,
          async () => {
            const response = await fetch(
              `${riskServiceUrl}/api/internal/rules/${ruleId}`,
            );
            if (!response.ok) {
              return {};
            }
            return (await response.json()) as RuleDetailsResponse;
          },
        );
        return [ruleId, body] as const;
      }),
    );

    return new Map(responses);
  }

  private extractRuleId(finding: FindingOrmEntity): string | null {
    if (finding.rulesId) {
      return finding.rulesId;
    }
    const details = finding.details;
    const fromDetails =
      details.rulesId ?? details.ruleId ?? details.rules_id ?? null;
    return typeof fromDetails === 'string' && fromDetails.trim().length > 0
      ? fromDetails
      : null;
  }

  private resolveRuleName(
    finding: FindingOrmEntity,
    ruleMap: Map<string, RuleDetailsResponse>,
  ): string | null {
    const ruleId = this.extractRuleId(finding);
    if (!ruleId) {
      return null;
    }
    return ruleMap.get(ruleId)?.name ?? null;
  }

  private async fetchUserNamesById(
    userIds: Array<string | null | undefined>,
  ): Promise<Map<string, { firstName: string | null; lastName: string | null }>> {
    const uniqueIds = Array.from(
      new Set(
        userIds.filter(
          (userId): userId is string =>
            typeof userId === 'string' && userId.trim().length > 0,
        ),
      ),
    ).map((userId) => userId.trim());
    const normalizedUniqueIds = Array.from(new Set(uniqueIds));
    const result = new Map<
      string,
      { firstName: string | null; lastName: string | null }
    >();
    if (normalizedUniqueIds.length === 0) {
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
      normalizedUniqueIds.map(async (userId) => {
        const profile = await this.readThroughExternalCache<{
          firstName: string | null;
          lastName: string | null;
        }>(`auth-user:${userId}`, async () => {
          const response = await fetch(
            `${authServiceUrl}/api/internal/users/${userId}`,
            {
              headers: { authorization },
            },
          );
          if (!response.ok) {
            return { firstName: null, lastName: null };
          }

          const body = (await response.json()) as InternalUserProfileResponse;
          const parts = this.extractUserNameParts(body);
          return {
            firstName: parts.firstName,
            lastName: parts.lastName,
          };
        });
        result.set(userId, profile);
      }),
    );

    return result;
  }

  private resolveFirstName(
    userId: string | null,
    users: Map<string, { firstName: string | null; lastName: string | null }>,
  ): string | null {
    const normalizedUserId = this.normalizeUserId(userId);
    if (!normalizedUserId) {
      return null;
    }
    return users.get(normalizedUserId)?.firstName ?? null;
  }

  private resolveLastName(
    userId: string | null,
    users: Map<string, { firstName: string | null; lastName: string | null }>,
  ): string | null {
    const normalizedUserId = this.normalizeUserId(userId);
    if (!normalizedUserId) {
      return null;
    }
    return users.get(normalizedUserId)?.lastName ?? null;
  }

  private normalizeUserId(userId: string | null | undefined): string | null {
    if (typeof userId !== 'string') {
      return null;
    }
    const normalized = userId.trim();
    return normalized.length > 0 ? normalized : null;
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

  private async readThroughExternalCache<T>(
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const cached = GetIncidentReportListUseCase.externalCache.get(key);
    if (cached && cached.expiresAt > now) {
      // LRU touch: move entry to the end.
      GetIncidentReportListUseCase.externalCache.delete(key);
      GetIncidentReportListUseCase.externalCache.set(key, cached);
      return cached.value as T;
    }

    if (cached) {
      GetIncidentReportListUseCase.externalCache.delete(key);
    }

    const value = await loader();
    GetIncidentReportListUseCase.externalCache.set(key, {
      value,
      expiresAt: now + GetIncidentReportListUseCase.EXTERNAL_CACHE_TTL_MS,
    });
    this.evictExternalCacheOverflow();
    return value;
  }

  private evictExternalCacheOverflow(): void {
    while (
      GetIncidentReportListUseCase.externalCache.size >
      GetIncidentReportListUseCase.EXTERNAL_CACHE_MAX_ITEMS
    ) {
      const oldestKey =
        GetIncidentReportListUseCase.externalCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      GetIncidentReportListUseCase.externalCache.delete(oldestKey);
    }
  }
}
