import { Controller, Get } from '@nestjs/common';
import { GetActionPlanListUseCase } from '../application/use-cases/get-action-plan-list.use-case';

@Controller('api/action-plans')
export class ActionPlanController {
  constructor(
    private readonly getActionPlanListUseCase: GetActionPlanListUseCase,
  ) {}

  @Get()
  findAll() {
    return this.getActionPlanListUseCase.execute();
  }
}
