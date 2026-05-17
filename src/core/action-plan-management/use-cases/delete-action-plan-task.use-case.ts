import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { ActionPlanTaskAccessService } from '../services/action-plan-task-access.service';

@Injectable()
export class DeleteActionPlanTaskUseCase {
  constructor(
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    private readonly actionPlanTaskAccessService: ActionPlanTaskAccessService,
  ) {}

  async execute(actionPlanId: string, taskId: string): Promise<void> {
    const { task } =
      await this.actionPlanTaskAccessService.assertCanManageActionPlanTask(
        actionPlanId,
        taskId,
      );

    await this.actionPlanTaskRepository.delete({ id: task.id });
  }
}
