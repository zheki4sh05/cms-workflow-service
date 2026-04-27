import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { GetActionPlanListUseCase } from '../../core/action-plan-management/use-cases/get-action-plan-list.use-case';
import { CreateActionPlanUseCase } from '../../core/action-plan-management/use-cases/create-action-plan.use-case';
import { CreateActionPlanDto } from './dto/create-action-plan.dto';

@Controller('api/action-plans')
export class ActionPlanController {
  constructor(
    private readonly getActionPlanListUseCase: GetActionPlanListUseCase,
    private readonly createActionPlanUseCase: CreateActionPlanUseCase,
  ) {}

  @Get()
  findAll() {
    return this.getActionPlanListUseCase.execute();
  }

  @Post()
  @ApiBody({ type: CreateActionPlanDto, required: true })
  create(@Body() body: CreateActionPlanDto) {
    return this.createActionPlanUseCase.execute(body);
  }
}
