import { Inject, Injectable } from '@nestjs/common';
import {
  INVESTIGATION_REPOSITORY,
  InvestigationRepositoryPort,
} from '../ports/investigation.repository.port';

@Injectable()
export class GetInvestigationListUseCase {
  constructor(
    @Inject(INVESTIGATION_REPOSITORY)
    private readonly investigationRepository: InvestigationRepositoryPort,
  ) {}

  execute() {
    return this.investigationRepository.findAll();
  }
}
