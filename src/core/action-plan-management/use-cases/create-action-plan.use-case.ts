import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import {
  ActionPlanTaskOrmEntity,
  ActionPlanTaskPriority,
  ActionPlanTaskStatus,
} from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';

interface CreateTaskPayload {
  title?: string;
  description?: string;
  priority?: string;
  dueDate?: string;
}

interface CreateActionPlanPayload {
  caseId?: string;
  title?: string;
  description?: string;
  tasks?: CreateTaskPayload[];
}

const ALLOWED_PRIORITIES: ActionPlanTaskPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
];
const DEFAULT_TASK_STATUS: ActionPlanTaskStatus = 'TODO';

@Injectable()
export class CreateActionPlanUseCase {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
  ) {}

  async execute(payload: CreateActionPlanPayload) {
    const caseId = payload.caseId?.trim();
    const title = payload.title?.trim();
    const description = payload.description?.trim();
    const tasks = payload.tasks ?? [];

    if (!caseId || !title || !description) {
      throw new BadRequestException('caseId, title and description are required');
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new BadRequestException('tasks must contain at least one task');
    }

    const currentCase = await this.caseRepository.findOne({ where: { id: caseId } });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    const existingPlan = await this.actionPlanRepository.findOne({
      where: { caseId: currentCase.id },
    });
    if (existingPlan) {
      throw new BadRequestException('Action plan for case already exists');
    }

    const validatedTasks = tasks.map((task, index) => {
      const taskTitle = task.title?.trim();
      const taskDescription = task.description?.trim();
      const priority = task.priority?.trim() as ActionPlanTaskPriority | undefined;
      const dueDateRaw = task.dueDate?.trim();

      if (!taskTitle || !taskDescription || !priority || !dueDateRaw) {
        throw new BadRequestException(`Task #${index + 1} has invalid payload`);
      }
      if (!ALLOWED_PRIORITIES.includes(priority)) {
        throw new BadRequestException(`Task #${index + 1} has invalid priority`);
      }
      const dueDateValue = new Date(dueDateRaw);
      if (Number.isNaN(dueDateValue.getTime())) {
        throw new BadRequestException(`Task #${index + 1} has invalid dueDate`);
      }

      return {
        id: randomUUID(),
        title: taskTitle,
        description: taskDescription,
        priority,
        dueDate: dueDateValue,
        status: DEFAULT_TASK_STATUS,
      };
    });

    const actionPlanId = randomUUID();
    await this.dataSource.transaction(async (manager) => {
      await manager.save(ActionPlanOrmEntity, {
        id: actionPlanId,
        caseId: currentCase.id,
        incidentId: currentCase.incidentId,
        title,
        description,
        comment: null,
      });

      for (const task of validatedTasks) {
        await manager.save(ActionPlanTaskOrmEntity, {
          id: task.id,
          actionPlanId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          dueDate: task.dueDate,
          status: task.status,
        });
      }

      await manager.update(
        CaseOrmEntity,
        { id: currentCase.id },
        { status: 'ACTION_PLAN' },
      );
    });

    return {
      id: actionPlanId,
      caseId: currentCase.id,
      caseStatus: 'ACTION_PLAN',
      title,
      description,
      tasks: validatedTasks,
    };
  }
}
