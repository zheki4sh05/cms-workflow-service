import { Inject, Injectable } from '@nestjs/common';
import {
  INCIDENT_REPOSITORY,
  IncidentRepositoryPort,
} from '../ports/incident.repository.port';

@Injectable()
export class GetIncidentListUseCase {
  constructor(
    @Inject(INCIDENT_REPOSITORY)
    private readonly incidentRepository: IncidentRepositoryPort,
  ) {}

  execute() {
    return this.incidentRepository.findAll();
  }
}
