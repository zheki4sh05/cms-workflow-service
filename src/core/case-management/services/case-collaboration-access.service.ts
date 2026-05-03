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
import { In, Not, Repository } from 'typeorm';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';

interface AuthUserDto {
  id: string;
  companyId: string;
  employeeId?: string;
}

interface InternalUserDto {
  roles?: string[];
}

@Injectable({ scope: Scope.REQUEST })
export class CaseCollaborationAccessService {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
  ) {}

  async assertCanCollaborate(targetCase: CaseOrmEntity): Promise<AuthUserDto> {
    const user = await this.fetchCurrentUser();
    const roles = await this.fetchUserRoles(user.id);
    if (roles.includes('SUPERVISOR')) {
      return user;
    }

    const assignedIds = [user.id, user.employeeId].filter(Boolean) as string[];
    if (assignedIds.length === 0) {
      throw new ForbiddenException('Not enough permissions');
    }

    if (
      targetCase.assignedUserId &&
      assignedIds.includes(targetCase.assignedUserId)
    ) {
      return user;
    }

    const relatedCase = await this.caseRepository.findOne({
      where: {
        incidentId: targetCase.incidentId,
        id: Not(targetCase.id),
        assignedUserId: In(assignedIds),
      },
    });

    if (!relatedCase) {
      throw new ForbiddenException('Not enough permissions');
    }

    return user;
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

    return user as AuthUserDto;
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
