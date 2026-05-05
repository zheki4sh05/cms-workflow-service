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
import { Repository } from 'typeorm';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { VerificationOrmEntity } from '../../../infrastructure/action-plan-management/persistence/verification.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';

interface AuthUserDto {
  id: string;
}

interface InternalUserDto {
  roles?: string[];
}

interface ReturnForRevisionPayload {
  comments?: string;
}

@Injectable({ scope: Scope.REQUEST })
export class ReturnActionPlanForRevisionUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(VerificationOrmEntity)
    private readonly verificationRepository: Repository<VerificationOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
  ) {}

  async execute(
    actionPlanId: string,
    payload: ReturnForRevisionPayload,
  ): Promise<CaseOrmEntity> {
    const comments = payload.comments?.trim();
    if (!comments) {
      throw new BadRequestException('comments is required');
    }

    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    if (!roles.includes('SUPERVISOR') && !roles.includes('EXECUTIVE')) {
      throw new ForbiddenException(
        'Only supervisor or executive can return action plan for revision',
      );
    }

    const actionPlan = await this.actionPlanRepository.findOne({
      where: { id: actionPlanId },
    });
    if (!actionPlan) {
      throw new NotFoundException('Action plan not found');
    }

    const verification = await this.verificationRepository.findOne({
      where: { actionPlanId },
    });
    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    verification.verified = false;
    verification.comments = comments;
    await this.verificationRepository.save(verification);

    actionPlan.comment = comments;
    actionPlan.showTasks = false;
    await this.actionPlanRepository.save(actionPlan);

    const currentCase = await this.caseRepository.findOne({
      where: { id: actionPlan.caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    currentCase.status = 'ACTION_PLAN';
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
}
