import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetActionPlanListUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-list.use-case';
import { CreateActionPlanUseCase } from '../../core/action-plan-management/use-cases/create-action-plan.use-case';
import { SubmitActionPlanUseCase } from '../../core/action-plan-management/use-cases/submit-action-plan.use-case';
import { ApproveVerificationUseCase } from '../../core/action-plan-management/use-cases/approve-verification.use-case';
import { AddActionPlanTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/add-action-plan-task-evidence.use-case';
import { GetActionPlanTaskEvidencesUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-task-evidences.use-case';
import { DownloadActionPlanTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/download-action-plan-task-evidence.use-case';
import { GetMyTasksUseCase } from '../../core/action-plan-management/use-cases/get-my-tasks.use-case';
import { GetTaskByIdUseCase } from '../../core/action-plan-management/use-cases/get-task-by-id.use-case';
import { UpdateTaskUseCase } from '../../core/action-plan-management/use-cases/update-task.use-case';
import { CompleteTaskUseCase } from '../../core/action-plan-management/use-cases/complete-task.use-case';
import { AddTaskEvidenceUseCase } from '../../core/action-plan-management/use-cases/add-task-evidence.use-case';
import { ACTION_PLAN_REPOSITORY } from '../../core/action-plan-management/ports/action-plan.repository.port';
import { InMemoryActionPlanRepository } from '../../infrastructure/action-plan-management/persistence/in-memory-action-plan.repository';
import { ActionPlanController } from './action-plan.controller';
import { ActionPlanOrmEntity } from '../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { ActionPlanTaskOrmEntity } from '../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { CaseOrmEntity } from '../../infrastructure/case-management/persistence/case.orm-entity';
import { VerificationOrmEntity } from '../../infrastructure/action-plan-management/persistence/verification.orm-entity';
import { SupervisorVerificationController } from './supervisor-verification.controller';
import { ActionPlanTaskEvidenceOrmEntity } from '../../infrastructure/action-plan-management/persistence/action-plan-task-evidence.orm-entity';
import { CaseManagementModule } from '../case-management/case-management.module';
import { TaskController } from './task.controller';
import { ActionPlanTaskAccessService } from '../../core/action-plan-management/services/action-plan-task-access.service';

@Module({
  imports: [
    CaseManagementModule,
    TypeOrmModule.forFeature([
      ActionPlanOrmEntity,
      ActionPlanTaskOrmEntity,
      CaseOrmEntity,
      VerificationOrmEntity,
      ActionPlanTaskEvidenceOrmEntity,
    ]),
  ],
  controllers: [ActionPlanController, SupervisorVerificationController, TaskController],
  providers: [
    GetActionPlanListUseCase,
    CreateActionPlanUseCase,
    SubmitActionPlanUseCase,
    ApproveVerificationUseCase,
    AddActionPlanTaskEvidenceUseCase,
    GetActionPlanTaskEvidencesUseCase,
    DownloadActionPlanTaskEvidenceUseCase,
    GetMyTasksUseCase,
    GetTaskByIdUseCase,
    UpdateTaskUseCase,
    CompleteTaskUseCase,
    AddTaskEvidenceUseCase,
    ActionPlanTaskAccessService,
    InMemoryActionPlanRepository,
    {
      provide: ACTION_PLAN_REPOSITORY,
      useExisting: InMemoryActionPlanRepository,
    },
  ],
})
export class ActionPlanManagementModule {}
