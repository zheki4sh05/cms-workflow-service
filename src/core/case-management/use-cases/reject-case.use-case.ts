import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { IncidentOrmEntity } from '../../../infrastructure/incident-management/persistence/incident.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';

interface RejectCasePayload {
  comment?: string;
}

@Injectable()
export class RejectCaseUseCase {
  constructor(
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(IncidentOrmEntity)
    private readonly incidentRepository: Repository<IncidentOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
  ) {}

  async execute(caseId: string, payload: RejectCasePayload) {
    const comment = payload.comment?.trim();
    if (!comment) {
      throw new BadRequestException('comment is required');
    }

    const currentCase = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    const incident = await this.incidentRepository.findOne({
      where: { id: currentCase.incidentId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const existingActionPlan = await this.actionPlanRepository.findOne({
      where: { caseId: currentCase.id },
    });
    if (existingActionPlan) {
      throw new BadRequestException('Action plan for case already exists');
    }

    await this.actionPlanRepository.save({
      id: randomUUID(),
      caseId: currentCase.id,
      incidentId: currentCase.incidentId,
      comment,
    });

    currentCase.status = 'REJECTED';
    await this.caseRepository.save(currentCase);

    const allIncidentCases = await this.caseRepository.find({
      where: { incidentId: currentCase.incidentId },
    });

    if (allIncidentCases.length === 1) {
      incident.status = 'RESOLVED';
    } else {
      const otherCases = allIncidentCases.filter((item) => item.id !== currentCase.id);
      const nonRejectedOtherCases = otherCases.filter(
        (item) => item.status !== 'REJECTED',
      );

      if (nonRejectedOtherCases.some((item) => item.status === 'ASSIGNED')) {
        incident.status = 'PARTLY_PROGRESS';
      } else if (
        nonRejectedOtherCases.length > 0 &&
        nonRejectedOtherCases.every((item) => item.status === 'INVESTIGATING')
      ) {
        incident.status = 'IN_PROGRESS';
      } else {
        incident.status = 'RESOLVED';
      }
    }

    const updatedIncident = await this.incidentRepository.save(incident);

    return {
      caseId: currentCase.id,
      caseStatus: currentCase.status,
      incidentId: updatedIncident.id,
      incidentStatus: updatedIncident.status,
    };
  }
}
