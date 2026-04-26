import { Module } from '@nestjs/common';
import { GetActionPlanListUseCase } from './application/use-cases/get-action-plan-list.use-case';
import { ACTION_PLAN_REPOSITORY } from './application/ports/action-plan.repository.port';
import { InMemoryActionPlanRepository } from './infrastructure/persistence/in-memory-action-plan.repository';
import { ActionPlanController } from './web/action-plan.controller';

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
