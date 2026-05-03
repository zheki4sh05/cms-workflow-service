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
  tasks?: CreateTaskPayload[] | string;
}

const ALLOWED_PRIORITIES: ActionPlanTaskPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
];
const DEFAULT_TASK_STATUS: ActionPlanTaskStatus = 'TODO';

function normalizeTasksInput(raw: unknown): CreateTaskPayload[] {
  let value: unknown = raw ?? [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      throw new BadRequestException(
        'tasks must be a valid JSON array string',
      );
    }
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException('tasks must be an array');
  }
  return value as CreateTaskPayload[];
}

@Injectable()
export class CreateActionPlanUseCase {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
  ) {}

  async execute(payload: CreateActionPlanPayload) {
    const caseId = payload.caseId?.trim();
    const title = payload.title?.trim();
    const description = payload.description?.trim();
    const tasks = normalizeTasksInput(payload.tasks);

    if (!caseId || !title || !description) {
      throw new BadRequestException(
        'caseId, title and description are required',
      );
    }

    const currentCase = await this.caseRepository.findOne({
      where: { id: caseId },
    });
    if (!currentCase) {
      throw new NotFoundException('Case not found');
    }

    const validatedTasks =
      tasks.length > 0
        ? tasks.map((task, index) => {
            const taskTitle = task.title?.trim();
            const taskDescription = task.description?.trim();
            const priority = task.priority?.trim() as
              | ActionPlanTaskPriority
              | undefined;
            const dueDateRaw = task.dueDate?.trim();

            if (
              !taskTitle ||
              !taskDescription ||
              !priority ||
              !dueDateRaw
            ) {
              throw new BadRequestException(
                `Task #${index + 1} has invalid payload`,
              );
            }
            if (!ALLOWED_PRIORITIES.includes(priority)) {
              throw new BadRequestException(
                `Task #${index + 1} has invalid priority`,
              );
            }
            const dueDateValue = new Date(dueDateRaw);
            if (Number.isNaN(dueDateValue.getTime())) {
              throw new BadRequestException(
                `Task #${index + 1} has invalid dueDate`,
              );
            }

            return {
              id: randomUUID(),
              title: taskTitle,
              description: taskDescription,
              priority,
              dueDate: dueDateValue,
              status: DEFAULT_TASK_STATUS,
            };
          })
        : [];

    const existingPlan = await this.actionPlanRepository.findOne({
      where: { caseId: currentCase.id },
    });

    let actionPlanId: string;

    if (existingPlan) {
      actionPlanId = existingPlan.id;
      await this.dataSource.transaction(async (manager) => {
        await manager.update(
          ActionPlanOrmEntity,
          { id: existingPlan.id },
          {
            title,
            description,
          },
        );

        for (const task of validatedTasks) {
          await manager.save(ActionPlanTaskOrmEntity, {
            id: task.id,
            actionPlanId: existingPlan.id,
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
    } else {
      actionPlanId = randomUUID();
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
    }

    const refreshedCase = await this.caseRepository.findOne({
      where: { id: currentCase.id },
    });

    const persistedTasks = await this.actionPlanTaskRepository.find({
      where: { actionPlanId },
      order: { dueDate: 'ASC' },
    });

    return {
      id: actionPlanId,
      caseId: currentCase.id,
      caseStatus: refreshedCase?.status ?? currentCase.status,
      title,
      description,
      tasks: persistedTasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        status: task.status,
      })),
    };
  }
}
