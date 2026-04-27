import { Inject, Injectable } from '@nestjs/common';
import * as actionPlanRepositoryPort from '../ports/action-plan.repository.port';

@Injectable()
export class GetActionPlanListUseCase {
  constructor(
    @Inject(actionPlanRepositoryPort.ACTION_PLAN_REPOSITORY)
    private readonly actionPlanRepository: actionPlanRepositoryPort.ActionPlanRepositoryPort,
  ) {}

  execute() {
    return this.actionPlanRepository.findAll();
  }
}
