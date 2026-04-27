import { Controller, Get, Param, Post } from '@nestjs/common';
import { GetIncidentInWorkUseCase } from '../../core/incident-management/use-cases/get-incident-in-work.use-case';
import { GetMyIncidentListUseCase } from '../../core/incident-management/use-cases/get-my-incident-list.use-case';

@Controller('api/incidents')
export class IncidentController {
  constructor(
    private readonly getIncidentInWorkUseCase: GetIncidentInWorkUseCase,
    private readonly getMyIncidentListUseCase: GetMyIncidentListUseCase,
  ) {}

  @Get('my')
  findMy() {
    return this.getMyIncidentListUseCase.execute();
  }

  @Post(':incidentId/get-in-work')
  getInWork(@Param('incidentId') incidentId: string) {
    return this.getIncidentInWorkUseCase.execute(incidentId);
  }
}
