import { Module } from '@nestjs/common';
import { GetActionPlanListUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-list.use-case';
import { ACTION_PLAN_REPOSITORY } from '../../core/action-plan-management/ports/action-plan.repository.port';
import { InMemoryActionPlanRepository } from '../../infrastructure/action-plan-management/persistence/in-memory-action-plan.repository';
import { ActionPlanController } from './action-plan.controller';

@Module({
  controllers: [ActionPlanController],
  providers: [
    GetActionPlanListUseCase,
    InMemoryActionPlanRepository,
    {
      provide: ACTION_PLAN_REPOSITORY,
      useExisting: InMemoryActionPlanRepository,
    },
  ],
})
export class ActionPlanManagementModule {}
