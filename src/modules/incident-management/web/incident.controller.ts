import { Controller, Get } from '@nestjs/common';
import { GetIncidentListUseCase } from '../application/use-cases/get-incident-list.use-case';

@Controller('api/incidents')
export class IncidentController {
  constructor(private readonly getIncidentListUseCase: GetIncidentListUseCase) {}

  @Get()
  findAll() {
    return this.getIncidentListUseCase.execute();
  }
}
