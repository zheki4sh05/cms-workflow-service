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
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { FindingOrmEntity } from '../../../infrastructure/incident-management/persistence/finding.orm-entity';

interface AuthUserDto {
  id: string;
  companyId: string;
  employeeId: string;
}

@Injectable({ scope: Scope.REQUEST })
export class AssignIncidentToMeUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
  ) {}

  async execute(incidentId: string): Promise<CaseOrmEntity> {
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

    const assignedUserIds = [user.id, user.employeeId].filter(Boolean);
    const currentCases = await this.caseRepository.find({
      where: { incidentId: incident.id },
    });

    const existingCase = currentCases.find((item) =>
      assignedUserIds.includes(item.assignedUserId ?? ''),
    );

    let targetCase = existingCase ?? null;
    if (!targetCase) {
      const userFinding = await this.findingRepository.findOne({
        where: assignedUserIds.map((assignedUserId) => ({
          incidentId: incident.id,
          assignedUserId,
        })),
      });

      if (!userFinding) {
        throw new ForbiddenException('Case for current user not found');
      }

      const assignedUserId = userFinding.assignedUserId;
      if (!assignedUserId) {
        throw new ForbiddenException('Case for current user not found');
      }

      targetCase = await this.caseRepository.save({
        id: randomUUID(),
        incidentId: incident.id,
        findingId: userFinding.id,
        assignedUserId,
        status: 'ASSIGNED',
      });
      currentCases.push(targetCase);
    }

    const allFindings = await this.findingRepository.find({
      where: { incidentId: incident.id },
    });
    const everyFindingAssigned = allFindings.every((finding) => {
      const hasCase = currentCases.some((item) => item.findingId === finding.id);
      return hasCase || !finding.assignedUserId;
    });
    incident.status = everyFindingAssigned ? 'IN_PROGRESS' : 'PARTLY_PROGRESS';
    await this.incidentRepository.save(incident);

    const updatedCase = await this.caseRepository.findOne({
      where: { id: targetCase.id },
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
      employeeId: user.employeeId ?? '',
    };
  }
}
