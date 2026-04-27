import { Module } from '@nestjs/common';
import { GetIncidentListUseCase } from '../../core/incident-management/use-cases/get-incident-list.use-case';
import { IngestIncidentTopicUseCase } from '../../core/incident-management/use-cases/ingest-incident-topic.use-case';
import { INCIDENT_REPOSITORY } from '../../core/incident-management/ports/incident.repository.port';
import { InMemoryIncidentRepository } from '../../infrastructure/incident-management/persistence/in-memory-incident.repository';
import { IncidentController } from './incident.controller';
import { KafkaIncidentTopicConsumer } from '../../infrastructure/incident-management/messaging/kafka-incident-topic.consumer';

@Module({
  controllers: [IncidentController, KafkaIncidentTopicConsumer],
  providers: [
    GetIncidentListUseCase,
    IngestIncidentTopicUseCase,
    InMemoryIncidentRepository,
    {
      provide: INCIDENT_REPOSITORY,
      useExisting: InMemoryIncidentRepository,
    },
  ],
})
export class IncidentManagementModule {}
