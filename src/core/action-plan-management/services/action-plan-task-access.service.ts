import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { VerificationOrmEntity } from '../../../infrastructure/action-plan-management/persistence/verification.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { CaseCollaborationAccessService } from '../../case-management/services/case-collaboration-access.service';
import { getOptionalEnvOrDefault } from '../../../web/app/env';

interface AuthUserDto {
  id: string;
  companyId: string;
  employeeId?: string;
}

interface InternalUserDto {
  roles?: string[];
  employeeId?: string;
}

interface DepartmentManagerDto {
  userId: string;
  employeeId: string;
}

@Injectable({ scope: Scope.REQUEST })
export class ActionPlanTaskAccessService {
  private readonly logger = new Logger(ActionPlanTaskAccessService.name);

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(VerificationOrmEntity)
    private readonly verificationRepository: Repository<VerificationOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    private readonly caseCollaborationAccessService: CaseCollaborationAccessService,
  ) {}

  async fetchCurrentUser(): Promise<AuthUserDto> {
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
      employeeId: user.employeeId,
    };
  }

  async assertCanManageActionPlanTask(
    actionPlanId: string,
    taskId: string,
  ): Promise<{
    task: ActionPlanTaskOrmEntity;
    actionPlan: ActionPlanOrmEntity;
    currentCase: CaseOrmEntity;
  }> {
    const actionPlan = await this.actionPlanRepository.findOne({
      where: { id: actionPlanId },
    });
    if (!actionPlan) {
      throw new NotFoundException('Action plan not found');
    }

    const task = await this.actionPlanTaskRepository.findOne({
      where: { id: taskId, actionPlanId: actionPlan.id },
    });
    if (!task) {
      throw new NotFoundException('Action plan task not found');
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: actionPlan.caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    const user = await this.fetchCurrentUser();
    const isCaseAssignee = this.isCaseAssignee(user, currentCase);
    const isDepartmentManager = await this.isDepartmentManagerForCase(
      user,
      currentCase,
      actionPlan.id,
    );

    if (!isCaseAssignee && !isDepartmentManager) {
      throw new ForbiddenException(
        'Only case assignee or department manager can manage action plan tasks',
      );
    }

    return { task, actionPlan, currentCase };
  }

  private isCaseAssignee(user: AuthUserDto, currentCase: CaseOrmEntity): boolean {
    const assigneeId = currentCase.assignedUserId?.trim();
    if (!assigneeId) {
      return false;
    }

    const userIds = [user.id, user.employeeId].filter(Boolean) as string[];
    return userIds.includes(assigneeId);
  }

  private async isDepartmentManagerForCase(
    user: AuthUserDto,
    currentCase: CaseOrmEntity,
    actionPlanId: string,
  ): Promise<boolean> {
    const verification = await this.verificationRepository.findOne({
      where: { actionPlanId },
    });
    if (verification) {
      const currentUserIds = [user.id, user.employeeId].filter(Boolean) as string[];
      if (
        verification.assignedUserForVerification &&
        currentUserIds.includes(verification.assignedUserForVerification)
      ) {
        return true;
      }
      const verificationEmployeeId =
        verification.assignedEmployeeForVerification?.trim();
      if (
        verificationEmployeeId &&
        user.employeeId?.trim() === verificationEmployeeId
      ) {
        return true;
      }
    }

    const assigneeId = currentCase.assignedUserId?.trim();
    if (!assigneeId) {
      return false;
    }

    const assigneeProfile = await this.fetchInternalUser(assigneeId);
    const assigneeEmployeeId = assigneeProfile.employeeId?.trim();
    if (!assigneeEmployeeId) {
      return false;
    }

    const departmentManager = await this.fetchDepartmentManager({
      userId: assigneeId,
      employeeId: assigneeEmployeeId,
      companyId: user.companyId,
    });

    const currentUserIds = [user.id, user.employeeId].filter(Boolean) as string[];
    return (
      currentUserIds.includes(departmentManager.userId) ||
      Boolean(
        departmentManager.employeeId &&
          user.employeeId?.trim() === departmentManager.employeeId,
      )
    );
  }

  private async fetchInternalUser(userId: string): Promise<InternalUserDto> {
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
      throw new BadRequestException('Unable to fetch case assignee profile');
    }

    return (await response.json()) as InternalUserDto;
  }

  private async fetchDepartmentManager(params: {
    userId: string;
    employeeId: string;
    companyId: string;
  }): Promise<DepartmentManagerDto> {
    const companyInfoServiceUrl = getOptionalEnvOrDefault(
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
    const requestUrl = `${companyInfoServiceUrl}/employee/department-manager?${query.toString()}`;

    let response: Response;
    try {
      response = await fetch(requestUrl, { headers: { authorization } });
    } catch (error) {
      this.logger.error(
        `Failed to call department manager endpoint: ${requestUrl}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to fetch department manager');
    }

    if (!response.ok) {
      throw new BadRequestException('Unable to fetch department manager');
    }

    const manager = (await response.json()) as Partial<DepartmentManagerDto>;
    if (!manager.userId || !manager.employeeId) {
      throw new BadRequestException('Invalid department manager payload');
    }

    return manager as DepartmentManagerDto;
  }

  async fetchUserRoles(userId: string): Promise<string[]> {
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

  async getTaskContext(taskId: string): Promise<{
    task: ActionPlanTaskOrmEntity;
    actionPlan: ActionPlanOrmEntity;
    currentCase: CaseOrmEntity;
    incident: IncidentOrmEntity;
  }> {
    const task = await this.actionPlanTaskRepository.findOne({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const actionPlan = await this.actionPlanRepository.findOne({
      where: { id: task.actionPlanId },
    });
    if (!actionPlan) {
      throw new NotFoundException('Action plan not found');
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: actionPlan.caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    await this.caseCollaborationAccessService.assertCanCollaborate(currentCase);

    const incident = await this.incidentRepository.findOne({
      where: { id: actionPlan.incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return { task, actionPlan, currentCase, incident };
  }
}
