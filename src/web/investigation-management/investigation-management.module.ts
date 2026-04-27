import { Module } from '@nestjs/common';
import { GetInvestigationListUseCase } from '../../core/investigation-management/use-cases/get-investigation-list.use-case';
import { INVESTIGATION_REPOSITORY } from '../../core/investigation-management/ports/investigation.repository.port';
import { InMemoryInvestigationRepository } from '../../infrastructure/investigation-management/persistence/in-memory-investigation.repository';
import { InvestigationController } from './investigation.controller';

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
