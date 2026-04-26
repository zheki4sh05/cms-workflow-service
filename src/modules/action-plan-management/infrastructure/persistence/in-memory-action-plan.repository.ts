import { Injectable } from '@nestjs/common';
import { ActionPlanRepositoryPort } from '../../application/ports/action-plan.repository.port';
import { ActionPlanEntity } from '../../domain/action-plan.entity';

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
