import { ActionPlanEntity } from '../../domain/action-plan.entity';

export const ACTION_PLAN_REPOSITORY = 'ACTION_PLAN_REPOSITORY';

export interface ActionPlanRepositoryPort {
  save(actionPlan: ActionPlanEntity): Promise<void>;
  findAll(): Promise<ActionPlanEntity[]>;
}
