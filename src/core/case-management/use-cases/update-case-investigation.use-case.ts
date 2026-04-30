import {
  BadRequestException,
  ForbiddenException,
  HttpException,
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
import { In, Repository } from 'typeorm';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { InvestigationOrmEntity } from '../../../infrastructure/investigation-management/persistence/investigation.orm-entity';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';

interface AuthUserDto {
  id: string;
  companyId: string;
  employeeId: string;
}

interface UpdateCaseInvestigationPayload {
  investigationNotes: string;
  rootCause: string;
  requiresCorrectiveAction: boolean;
}

@Injectable({ scope: Scope.REQUEST })
export class UpdateCaseInvestigationUseCase {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(InvestigationOrmEntity)
    private readonly investigationRepository: Repository<InvestigationOrmEntity>,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
  ) {}

  async execute(
    caseId: string,
    payload: UpdateCaseInvestigationPayload,
  ): Promise<CaseOrmEntity> {
    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new HttpException(
        {
          message: 'Случай не найден',
          code: 'CASE_NOT_FOUND',
        },
        404,
      );
    }

    const incident = await this.incidentRepository.findOne({
      where: { id: currentCase.incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const user = await this.fetchCurrentUser();
    if (user.companyId !== incident.companyId) {
      throw new ForbiddenException('User does not belong to incident company');
    }

    const assignedUserIds = [user.id, user.employeeId].filter(Boolean);
    const assignedCase = await this.caseRepository.findOne({
      where: {
        id: currentCase.id,
        incidentId: incident.id,
        assignedUserId: In(assignedUserIds),
      },
    });
    if (!assignedCase) {
      throw new ForbiddenException('Case for current user not found');
    }

    const investigation = await this.investigationRepository.findOne({
      where: { caseId: currentCase.id },
    });

    const investigationRecord =
      investigation ??
      this.investigationRepository.create({
        id: randomUUID(),
        caseId: currentCase.id,
      });

    investigationRecord.investigationNotes = payload.investigationNotes;
    investigationRecord.rootCause = payload.rootCause;
    investigationRecord.requiresCorrectiveAction =
      payload.requiresCorrectiveAction;
    await this.investigationRepository.save(investigationRecord);

    currentCase.status = 'INVESTIGATING';
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
      employeeId: user.employeeId ?? '',
    };
  }
}
