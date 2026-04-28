import { Controller, Get } from '@nestjs/common';
import { GetMyIncidentListUseCase } from '../../core/incident-management/use-cases/get-my-incident-list.use-case';

@Controller('api/incidents')
export class IncidentController {
  constructor(
    private readonly getMyIncidentListUseCase: GetMyIncidentListUseCase,
  ) {}

  @Get('my')
  findMy() {
    return this.getMyIncidentListUseCase.execute();
  }

}
