import { Inject, Injectable } from '@nestjs/common';
import {
  CASE_REPOSITORY,
  CaseRepositoryPort,
} from '../ports/case.repository.port';

@Injectable()
export class GetCaseListUseCase {
  constructor(
    @Inject(CASE_REPOSITORY)
    private readonly caseRepository: CaseRepositoryPort,
  ) {}

  execute() {
    return this.caseRepository.findAll();
  }
}
