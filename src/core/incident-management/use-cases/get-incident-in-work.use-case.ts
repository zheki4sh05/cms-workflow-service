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
import { Repository } from 'typeorm';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import type { Request } from 'express';

interface AuthUserDto {
  id: string;
  companyId: string;
  employeeId: string;
}

@Injectable({ scope: Scope.REQUEST })
export class GetIncidentInWorkUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
  ) {}

  async execute(incidentId: string): Promise<IncidentOrmEntity> {
    const incident = await this.incidentRepository.findOne({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const user = await this.fetchCurrentUser();
    if (user.companyId !== incident.companyId) {
      throw new ForbiddenException('User does not belong to incident company');
    }

    const responsibleUserIds = [user.id, user.employeeId].filter(Boolean);
    const userCase = await this.caseRepository.findOne({
      where: responsibleUserIds.map((responsibleUserId) => ({
        incidentId: incident.id,
        responsibleUserId,
      })),
    });

    if (!userCase) {
      throw new ForbiddenException('Case for current user not found');
    }

    userCase.status = 'INVESTIGATING';
    await this.caseRepository.save(userCase);

    const allCases = await this.caseRepository.find({
      where: { incidentId: incident.id },
    });

    const everyCaseInvestigating = allCases.every(
      (item) => item.status === 'INVESTIGATING',
    );
    incident.status = everyCaseInvestigating ? 'IN_PROGRESS' : 'PARTLY_PROGRESS';

    return this.incidentRepository.save(incident);
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
