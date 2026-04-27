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
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';

interface AuthUserDto {
  id: string;
  companyId: string;
  employeeId: string;
}

@Injectable({ scope: Scope.REQUEST })
export class GetMyIncidentListUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
  ) {}

  async execute(): Promise<IncidentOrmEntity[]> {
    const user = await this.fetchCurrentUser();
    const assignedUserIds = [user.id, user.employeeId].filter(Boolean);

    if (assignedUserIds.length === 0) {
      return [];
    }

    const cases = await this.caseRepository.find({
      where: assignedUserIds.map((assignedUserId) => ({
        assignedUserId,
      })),
    });

    const incidentIds = Array.from(new Set(cases.map((item) => item.incidentId)));
    if (incidentIds.length === 0) {
      return [];
    }

    return this.incidentRepository.find({
      where: {
        id: In(incidentIds),
        companyId: user.companyId,
      },
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
    if (!user.id || !user.companyId) {
      throw new UnauthorizedException('Invalid user payload');
    }

    return {
      id: user.id,
      companyId: user.companyId,
      employeeId: user.employeeId ?? '',
    };
  }
}
