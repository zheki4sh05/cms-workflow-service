import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetActionPlanListUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-list.use-case';
import { CreateActionPlanUseCase } from '../../core/action-plan-management/use-cases/create-action-plan.use-case';
import { SubmitActionPlanUseCase } from '../../core/action-plan-management/use-cases/submit-action-plan.use-case';
import { ACTION_PLAN_REPOSITORY } from '../../core/action-plan-management/ports/action-plan.repository.port';
import { InMemoryActionPlanRepository } from '../../infrastructure/action-plan-management/persistence/in-memory-action-plan.repository';
import { ActionPlanController } from './action-plan.controller';
import { ActionPlanOrmEntity } from '../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { ActionPlanTaskOrmEntity } from '../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { CaseOrmEntity } from '../../infrastructure/case-management/persistence/case.orm-entity';
import { VerificationOrmEntity } from '../../infrastructure/action-plan-management/persistence/verification.orm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActionPlanOrmEntity,
      ActionPlanTaskOrmEntity,
      CaseOrmEntity,
      VerificationOrmEntity,
    ]),
  ],
  controllers: [ActionPlanController],
  providers: [
    GetActionPlanListUseCase,
    CreateActionPlanUseCase,
    SubmitActionPlanUseCase,
    InMemoryActionPlanRepository,
    {
      provide: ACTION_PLAN_REPOSITORY,
      useExisting: InMemoryActionPlanRepository,
    },
  ],
})
export class ActionPlanManagementModule {}
