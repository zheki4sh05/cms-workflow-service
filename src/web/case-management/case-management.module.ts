import { Module } from '@nestjs/common';
import { GetCaseListUseCase } from '../../core/case-management/use-cases/get-case-list.use-case';
import { CASE_REPOSITORY } from '../../core/case-management/ports/case.repository.port';
import { InMemoryCaseRepository } from '../../infrastructure/case-management/persistence/in-memory-case.repository';
import { CaseController } from './case.controller';

@Module({
  controllers: [CaseController],
  providers: [
    GetCaseListUseCase,
    InMemoryCaseRepository,
    {
      provide: CASE_REPOSITORY,
      useExisting: InMemoryCaseRepository,
    },
  ],
  exports: [GetCaseListUseCase],
})
export class CaseManagementModule {}
