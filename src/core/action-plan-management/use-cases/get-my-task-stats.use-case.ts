import {
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ActionPlanTaskOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan-task.orm-entity';
import { ActionPlanOrmEntity } from '../../../infrastructure/action-plan-management/persistence/action-plan.orm-entity';
import { CaseOrmEntity } from '../../../infrastructure/case-management/persistence/case.orm-entity';
import { ActionPlanTaskAccessService } from '../services/action-plan-task-access.service';

interface TaskStatsResult {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  dueToday: number;
  dueTodayIds: string[];
  dueTomorrow: number;
  dueTomorrowIds: string[];
}

@Injectable()
export class GetMyTaskStatsUseCase {
  constructor(
    @InjectRepository(ActionPlanTaskOrmEntity)
    private readonly actionPlanTaskRepository: Repository<ActionPlanTaskOrmEntity>,
    @InjectRepository(ActionPlanOrmEntity)
    private readonly actionPlanRepository: Repository<ActionPlanOrmEntity>,
    @InjectRepository(CaseOrmEntity)
    private readonly caseRepository: Repository<CaseOrmEntity>,
    private readonly actionPlanTaskAccessService: ActionPlanTaskAccessService,
  ) {}

  async execute(): Promise<TaskStatsResult> {
    const user = await this.actionPlanTaskAccessService.fetchCurrentUser();
    const roles = await this.actionPlanTaskAccessService.fetchUserRoles(user.id);
    if (!roles.includes('MANAGER')) {
      return this.buildEmptyStats();
    }

    const assignedUserIds = [user.id, user.employeeId].filter(Boolean) as string[];
    if (assignedUserIds.length === 0) {
      return this.buildEmptyStats();
    }

    const cases = await this.caseRepository.find({
      where: assignedUserIds.map((assignedUserId) => ({ assignedUserId })),
    });
    if (cases.length === 0) {
      return this.buildEmptyStats();
    }

    const caseIds = cases.map((item) => item.id);
    const actionPlans = await this.actionPlanRepository.find({
      where: { caseId: In(caseIds) },
    });
    if (actionPlans.length === 0) {
      return this.buildEmptyStats();
    }

    const visibleActionPlans = actionPlans.filter((plan) => plan.showTasks);
    if (visibleActionPlans.length === 0) {
      return this.buildEmptyStats();
    }

    const tasks = await this.actionPlanTaskRepository.find({
      where: { actionPlanId: In(visibleActionPlans.map((plan) => plan.id)) },
    });
    if (tasks.length === 0) {
      return this.buildEmptyStats();
    }

    const stats = this.buildEmptyStats();
    stats.total = tasks.length;

    const now = new Date();
    const startOfToday = this.startOfDay(now);
    const startOfTomorrow = this.addDays(startOfToday, 1);
    const startOfDayAfterTomorrow = this.addDays(startOfToday, 2);

    for (const task of tasks) {
      if (task.status === 'TODO') {
        stats.todo += 1;
      } else if (task.status === 'IN_PROGRESS') {
        stats.inProgress += 1;
      } else if (task.status === 'DONE') {
        stats.done += 1;
      }

      const isDone = task.status === 'DONE';
      if (!isDone && task.dueDate.getTime() < now.getTime()) {
        stats.overdue += 1;
      }

      if (
        !isDone &&
        task.dueDate.getTime() >= startOfToday.getTime() &&
        task.dueDate.getTime() < startOfTomorrow.getTime()
      ) {
        stats.dueToday += 1;
        stats.dueTodayIds.push(task.id);
      }

      if (
        !isDone &&
        task.dueDate.getTime() >= startOfTomorrow.getTime() &&
        task.dueDate.getTime() < startOfDayAfterTomorrow.getTime()
      ) {
        stats.dueTomorrow += 1;
        stats.dueTomorrowIds.push(task.id);
      }
    }

    return stats;
  }

  private startOfDay(baseDate: Date): Date {
    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      0,
      0,
      0,
      0,
    );
  }

  private addDays(baseDate: Date, days: number): Date {
    return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private buildEmptyStats(): TaskStatsResult {
    return {
      total: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
      overdue: 0,
      dueToday: 0,
      dueTodayIds: [],
      dueTomorrow: 0,
      dueTomorrowIds: [],
    };
  }
}
