import { Inject, Injectable } from '@nestjs/common';
import {
  ACTION_PLAN_REPOSITORY,
  ActionPlanRepositoryPort,
} from '../ports/action-plan.repository.port';

@Injectable()
export class GetActionPlanListUseCase {
  constructor(
    @Inject(ACTION_PLAN_REPOSITORY)
    private readonly actionPlanRepository: ActionPlanRepositoryPort,
  ) {}

  execute() {
    return this.actionPlanRepository.findAll();
  }
}
