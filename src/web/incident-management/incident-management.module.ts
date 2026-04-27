import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetIncidentListUseCase } from '../../core/incident-management/use-cases/get-incident-list.use-case';
import { IngestIncidentTopicUseCase } from '../../core/incident-management/use-cases/ingest-incident-topic.use-case';
import { GetIncidentInWorkUseCase } from '../../core/incident-management/use-cases/get-incident-in-work.use-case';
import { GetMyIncidentListUseCase } from '../../core/incident-management/use-cases/get-my-incident-list.use-case';
import { INCIDENT_REPOSITORY } from '../../core/incident-management/ports/incident.repository.port';
import { InMemoryIncidentRepository } from '../../infrastructure/incident-management/persistence/in-memory-incident.repository';
import { IncidentController } from './incident.controller';
import { KafkaIncidentTopicConsumer } from '../../infrastructure/incident-management/messaging/kafka-incident-topic.consumer';
import { IncidentOrmEntity } from '../../infrastructure/incident-management/persistence/incident.orm-entity';
import { CaseOrmEntity } from '../../infrastructure/case-management/persistence/case.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([IncidentOrmEntity, CaseOrmEntity])],
  controllers: [IncidentController, KafkaIncidentTopicConsumer],
  providers: [
    GetIncidentListUseCase,
    GetIncidentInWorkUseCase,
    GetMyIncidentListUseCase,
    IngestIncidentTopicUseCase,
    InMemoryIncidentRepository,
    {
      provide: INCIDENT_REPOSITORY,
      useExisting: InMemoryIncidentRepository,
    },
  ],
})
export class IncidentManagementModule {}
