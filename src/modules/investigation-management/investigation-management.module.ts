import { Module } from '@nestjs/common';
import { GetInvestigationListUseCase } from './application/use-cases/get-investigation-list.use-case';
import { INVESTIGATION_REPOSITORY } from './application/ports/investigation.repository.port';
import { InMemoryInvestigationRepository } from './infrastructure/persistence/in-memory-investigation.repository';
import { InvestigationController } from './web/investigation.controller';

@Module({
  controllers: [InvestigationController],
  providers: [
    GetInvestigationListUseCase,
    InMemoryInvestigationRepository,
    {
      provide: INVESTIGATION_REPOSITORY,
      useExisting: InMemoryInvestigationRepository,
    },
  ],
})
export class InvestigationManagementModule {}
