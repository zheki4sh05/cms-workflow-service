import { Module } from '@nestjs/common';
import { GetCaseListUseCase } from './application/use-cases/get-case-list.use-case';
import { CASE_REPOSITORY } from './application/ports/case.repository.port';
import { InMemoryCaseRepository } from './infrastructure/persistence/in-memory-case.repository';
import { CaseController } from './web/case.controller';

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
