import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';

@Injectable()
export class SubmitActionPlanUseCase {
  constructor(
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
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
}
