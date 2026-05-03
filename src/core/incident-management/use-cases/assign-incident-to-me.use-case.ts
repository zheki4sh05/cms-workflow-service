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
import { DataSource, In, Repository } from 'typeorm';
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
    private readonly dataSource: DataSource,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(FindingOrmEntity)
    private readonly findingRepository: Repository<FindingOrmEntity>,
  ) {}

  async execute(incidentId: string): Promise<CaseOrmEntity[]> {
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

    const managerIds = [user.id, user.employeeId]
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter((id) => id.length > 0);

    const findings = await this.findingRepository.find({
      where: { incidentId: incident.id },
      order: { id: 'ASC' },
    });

    /** Назначенные менеджеру или ещё без ответственного (берём на себя). Чужие — пропускаем. */
    const claimableFindings = findings.filter((finding) => {
      const raw = finding.assignedUserId?.trim();
      if (!raw) {
        return true;
      }
      return managerIds.includes(raw);
    });

    if (claimableFindings.length === 0) {
      throw new ForbiddenException(
        'No findings to assign: none are yours or unassigned',
      );
    }

    const ensuredCaseIds: string[] = [];

    await this.dataSource.transaction(async (manager) => {
      for (const finding of claimableFindings) {
        let assigneeId = finding.assignedUserId?.trim() || null;
        if (!assigneeId) {
          assigneeId = user.id;
          await manager.update(
            FindingOrmEntity,
            { id: finding.id },
            { assignedUserId: assigneeId },
          );
        }

        const existing = await manager.findOne(CaseOrmEntity, {
          where: {
            incidentId: incident.id,
            findingId: finding.id,
            assignedUserId: assigneeId,
          },
        });

        if (existing) {
          ensuredCaseIds.push(existing.id);
          continue;
        }

        const saved = await manager.save(CaseOrmEntity, {
          id: randomUUID(),
          incidentId: incident.id,
          findingId: finding.id,
          assignedUserId: assigneeId,
          status: 'ASSIGNED',
        });
        ensuredCaseIds.push(saved.id);
      }
    });

    const currentCases = await this.caseRepository.find({
      where: { incidentId: incident.id },
    });

    const allFindings = await this.findingRepository.find({
      where: { incidentId: incident.id },
    });
    const everyFindingAssigned = allFindings.every((finding) => {
      const hasCase = currentCases.some(
        (item) => item.findingId === finding.id,
      );
      return hasCase || !finding.assignedUserId?.trim();
    });
    incident.status = everyFindingAssigned ? 'IN_PROGRESS' : 'PARTLY_PROGRESS';
    await this.incidentRepository.save(incident);

    return this.caseRepository.find({
      where: { id: In(ensuredCaseIds) },
      relations: { investigation: true },
      order: { findingId: 'ASC' },
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
