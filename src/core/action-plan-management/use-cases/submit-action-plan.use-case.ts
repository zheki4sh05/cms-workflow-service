import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { VerificationOrmEntity } from '../../../infrastructure/action-plan-management/persistence/verification.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { getOptionalEnvOrDefault } from '../../../web/app/env';

interface AuthUserDto {
  id: string;
  companyId: string;
}

interface InternalUserDto {
  roles?: string[];
}

interface DepartmentManagerDto {
  departmentId: string;
  employeeId: string;
  userId: string;
  companyId: string;
  role: string;
}

@Injectable({ scope: Scope.REQUEST })
export class SubmitActionPlanUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(VerificationOrmEntity)
    private readonly verificationRepository: Repository<VerificationOrmEntity>,
  ) {}

  async execute(planId: string): Promise<CaseOrmEntity> {
    const actionPlan = await this.actionPlanRepository.findOne({
      where: { id: planId },
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

    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    if (!roles.includes('MANAGER')) {
      throw new ForbiddenException('Only manager can submit action plan');
    }

    const requesterEmployeeId = this.extractEmployeeIdHeader();
    const departmentManager = await this.fetchDepartmentManager({
      userId: user.id,
      employeeId: requesterEmployeeId,
      companyId: user.companyId,
    });

    const existingVerification = await this.verificationRepository.findOne({
      where: { actionPlanId: actionPlan.id },
    });
    const verification = this.verificationRepository.create({
      id: existingVerification?.id ?? randomUUID(),
      actionPlanId: actionPlan.id,
      verified: false,
      assignedUserForVerification: departmentManager.userId,
      assignedEmployeeForVerification: departmentManager.employeeId,
      comments: existingVerification?.comments ?? null,
    });
    await this.verificationRepository.save(verification);

    currentCase.status = 'WAITING_VERIFICATION';
    await this.caseRepository.save(currentCase);

    const updatedCase = await this.caseRepository.findOne({
      where: { id: currentCase.id },
      relations: { investigation: true },
    });
    if (!updatedCase) {
      throw new NotFoundException('Case not found');
    }

    return updatedCase;
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

    const response = await fetch(
      `${authServiceUrl}/api/internal/users/${userId}`,
      {
        headers: { authorization },
      },
    );
    if (!response.ok) {
      throw new UnauthorizedException('Unable to fetch user roles');
    }

    const user = (await response.json()) as InternalUserDto;
    return Array.isArray(user.roles) ? user.roles : [];
  }

  private extractEmployeeIdHeader(): string {
    const employeeId = this.request.header('EmployeeId');
    if (!employeeId) {
      throw new BadRequestException('EmployeeId header is required');
    }

    return employeeId;
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

    const response = await fetch(
      `${companyInfoServiceUrl}/employee/department-manager?${query.toString()}`,
      { headers: { authorization } },
    );
    if (!response.ok) {
      throw new BadRequestException('Unable to fetch department manager');
    }

    const manager = (await response.json()) as Partial<DepartmentManagerDto>;
    if (!manager.userId || !manager.employeeId) {
      throw new BadRequestException('Invalid department manager payload');
    }

    return manager as DepartmentManagerDto;
  }
}
