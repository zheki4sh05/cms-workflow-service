import { Controller, Get } from '@nestjs/common';
import { GetCaseListUseCase } from '../application/use-cases/get-case-list.use-case';

@Controller('api/cases')
export class CaseController {
  constructor(private readonly getCaseListUseCase: GetCaseListUseCase) {}

  @Get()
  findAll() {
    return this.getCaseListUseCase.execute();
  }
}
