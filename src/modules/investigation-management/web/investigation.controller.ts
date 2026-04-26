import { Controller, Get } from '@nestjs/common';
import { GetInvestigationListUseCase } from '../application/use-cases/get-investigation-list.use-case';

@Controller('api/investigations')
export class InvestigationController {
  constructor(
    private readonly getInvestigationListUseCase: GetInvestigationListUseCase,
  ) {}

  @Get()
  findAll() {
    return this.getInvestigationListUseCase.execute();
  }
}
