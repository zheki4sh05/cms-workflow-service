import { Injectable } from '@nestjs/common';
import { ActionPlanRepositoryPort } from '../../../core/action-plan-management/ports/action-plan.repository.port';
import { ActionPlanEntity } from '../../../core/action-plan-management/domain/action-plan.entity';

@Injectable()
export class InMemoryActionPlanRepository implements ActionPlanRepositoryPort {
  private readonly plans = new Map<string, ActionPlanEntity>();

  async save(actionPlan: ActionPlanEntity): Promise<void> {
    this.plans.set(actionPlan.id, actionPlan);
  }

  async findAll(): Promise<ActionPlanEntity[]> {
    return Array.from(this.plans.values());
  }
}
